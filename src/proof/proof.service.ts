import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, ProofType } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { generateOtp, verifyOtp } from 'src/common/utils/otp.util';
import { ProofDto } from './dtos/proof.dto';
import { MediasService } from 'src/medias/medias.service';
import { PhoneService } from 'src/phone/phone.service';

type ProofEvent = { name: string; payload: unknown };

@Injectable()
export class ProofService {
  private proofs: DatabaseService['missionProof'];

  // Verrouillage anti brute-force : au-delà, le code courant est gelé et le
  // shipper doit en régénérer un nouveau.
  static readonly MAX_OTP_ATTEMPTS = 5;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mediasService: MediasService,
    private readonly phoneService: PhoneService,
  ) {
    this.proofs = this.databaseService.missionProof;
  }

  static readonly PROOF_IMAGE_INCLUDE = {
    images: {
      include: { image: true },
      orderBy: { createdAt: 'asc' as const },
    },
  } as const;

  // Upload photos for a proof — upserts the proof record if it doesn't exist yet
  async addImages(
    missionId: string,
    type: ProofType,
    createdById: string,
    verifiedById: string,
    files: Express.Multer.File[],
  ) {
    // Ensure proof record exists (without OTP — photos can be uploaded before code generation)
    const proof = await this.proofs.upsert({
      where: { missionId_type: { missionId, type } },
      create: { missionId, type, createdById, verifiedById },
      update: {},
    });

    const medias = await this.mediasService.createManyImages(files);

    await this.databaseService.missionProofImage.createMany({
      data: medias.map((m) => ({ proofId: proof.id, imageId: m.id })),
    });

    return this.proofs.findUnique({
      where: { id: proof.id },
      include: ProofService.PROOF_IMAGE_INCLUDE,
    });
  }

  // Called by Shipper — generates OTP and returns the plain code to display in their app
  async create(data: ProofDto): Promise<{ code: string; expiresAt: Date }> {
    const { plain, hash, expiresAt } = await generateOtp();

    // Upsert: regenerates a fresh OTP if one already exists (e.g. expired)
    await this.proofs.upsert({
      where: { missionId_type: { missionId: data.missionId, type: data.type } },
      create: { ...data, otpHash: hash, otpExpiresAt: expiresAt },
      update: {
        otpHash: hash,
        otpExpiresAt: expiresAt,
        otpUsedAt: null,
        otpAttempts: 0, // nouveau code → compteur d'essais remis à zéro
      },
    });

    return { code: plain, expiresAt };
  }

  /**
   * Génération du code de livraison par le shipper (mission IN_TRANSIT).
   * Si un destinataire est renseigné, le code lui part par SMS et n'est PAS
   * renvoyé à l'expéditeur : sinon il pourrait auto-confirmer la livraison
   * sans remise réelle. On ne retombe sur l'affichage côté expéditeur que
   * s'il n'y a pas de destinataire joignable.
   */
  async generateDeliveryCode(missionId: string, requesterId: string) {
    const mission = await this.databaseService.mission.findUnique({
      where: { id: missionId },
      select: {
        status: true,
        shipperId: true,
        carrierId: true,
        recipientPhone: true,
      },
    });
    if (!mission) throw new NotFoundException();
    // Le code de livraison se génère pendant le transport (le pickup vérifié
    // a déjà fait passer la mission en IN_TRANSIT)
    if (mission.status !== 'IN_TRANSIT') {
      throw new BadRequestException(
        'Mission must be in transit before generating a delivery proof',
      );
    }
    if (mission.shipperId !== requesterId) throw new ForbiddenException();
    if (!mission.carrierId)
      throw new BadRequestException('No carrier assigned to this mission yet');

    const otp = await this.create({
      missionId,
      type: 'DELIVERY',
      createdById: mission.shipperId,
      verifiedById: mission.carrierId,
    });

    let sentToRecipient = false;
    if (mission.recipientPhone) {
      try {
        await this.phoneService.sendDeliveryCode(
          mission.recipientPhone,
          otp.code,
          otp.expiresAt,
        );
        sentToRecipient = true;
      } catch {
        // L'échec du SMS ne doit pas bloquer la génération : le shipper
        // garde le code à l'écran et peut le transmettre lui-même.
      }
    }

    if (sentToRecipient) {
      return { expiresAt: otp.expiresAt, sentToRecipient };
    }
    return { ...otp, sentToRecipient };
  }

  // Called by Carrier — enters the code received from Shipper
  async verify({
    missionId,
    type,
    code,
    verifiedById,
  }: {
    missionId: string;
    type: ProofType;
    code: string;
    verifiedById: string;
  }) {
    const proof = await this.loadVerifiableProof({
      missionId,
      type,
      verifiedById,
    });
    await this.checkOtpOrCountAttempt(proof, code);

    // Les événements sont émis APRÈS le commit : émettre dans la transaction
    // annoncerait « preuve vérifiée » à des clients alors qu'un rollback peut
    // encore tout annuler.
    const events: ProofEvent[] = [];

    const verified = await this.databaseService.$transaction(async (tx) => {
      // Verrou optimiste : deux soumissions concurrentes du même code valide
      // ne peuvent pas transiter la mission deux fois — seule la première
      // écriture matche (otpUsedAt encore null).
      const { count } = await tx.missionProof.updateMany({
        where: { id: proof.id, otpUsedAt: null },
        data: { otpUsedAt: new Date(), verifiedById },
      });
      if (count === 0) {
        throw new BadRequestException('This code has already been used');
      }

      const missionPackages = await tx.missionPackage.findMany({
        where: { missionId },
        select: { packageId: true },
      });
      const packageIds = missionPackages.map((mp) => mp.packageId);

      if (type === 'PICKUP') {
        await this.applyPickupTransition(tx, missionId, packageIds);
      }
      if (type === 'DELIVERY') {
        await this.applyDeliveryTransition(tx, missionId, packageIds);
      }

      const updatedProof = await tx.missionProof.findUnique({
        where: { id: proof.id },
      });

      events.push(...(await this.collectPostCommitEvents(tx, missionId, type)));

      return updatedProof;
    });

    for (const e of events) {
      this.eventEmitter.emit(e.name, e.payload);
    }
    return verified;
  }

  /**
   * Charge la preuve et applique les gardes OTP : existence, code généré,
   * déjà utilisé, expiration, verrouillage au premier vérificateur, plafond
   * d'essais anti brute-force.
   */
  private async loadVerifiableProof({
    missionId,
    type,
    verifiedById,
  }: {
    missionId: string;
    type: ProofType;
    verifiedById: string;
  }) {
    const proof = await this.proofs.findUnique({
      where: { missionId_type: { missionId, type } },
    });

    if (!proof) {
      throw new NotFoundException(
        'No proof found — ask the shipper to generate a code first',
      );
    }
    if (!proof.otpHash) {
      throw new BadRequestException(
        'No code generated yet — ask the shipper to generate one',
      );
    }
    if (proof.otpUsedAt) {
      throw new BadRequestException('This code has already been used');
    }
    if (proof.otpExpiresAt < new Date()) {
      throw new BadRequestException(
        'Code expired — ask the shipper to generate a new one',
      );
    }
    if (proof.verifiedById && proof.verifiedById !== verifiedById) {
      throw new ForbiddenException();
    }
    if (proof.otpAttempts >= ProofService.MAX_OTP_ATTEMPTS) {
      throw new BadRequestException(
        'Too many attempts — ask the shipper to generate a new code',
      );
    }
    return { ...proof, otpHash: proof.otpHash };
  }

  /** Vérifie le code ; un échec incrémente le compteur anti brute-force. */
  private async checkOtpOrCountAttempt(
    proof: { id: string; otpHash: string },
    code: string,
  ) {
    const isValid = await verifyOtp({ hash: proof.otpHash, plain: code });
    if (!isValid) {
      await this.proofs.update({
        where: { id: proof.id },
        data: { otpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid code');
    }
  }

  /** PICKUP : les colis passent PICKED_UP, la mission entre IN_TRANSIT. */
  private async applyPickupTransition(
    tx: Prisma.TransactionClient,
    missionId: string,
    packageIds: string[],
  ) {
    await tx.package.updateMany({
      where: { id: { in: packageIds } },
      data: { status: 'PICKED_UP' },
    });
    // Mission enters IN_TRANSIT — carrier has the packages
    await tx.mission.update({
      where: { id: missionId },
      data: { status: 'IN_TRANSIT' },
    });
  }

  /** DELIVERY : colis livrés, mission et annonce COMPLETED, transaction soldée. */
  private async applyDeliveryTransition(
    tx: Prisma.TransactionClient,
    missionId: string,
    packageIds: string[],
  ) {
    const mission = await tx.mission.findUnique({
      where: { id: missionId },
      select: { advertisementId: true, shipperId: true, carrierId: true },
    });

    await tx.package.updateMany({
      where: { id: { in: packageIds } },
      data: { status: 'DELIVERED' },
    });
    await tx.mission.update({
      where: { id: missionId },
      data: { status: 'COMPLETED' },
    });
    await tx.advertisement.update({
      where: { id: mission.advertisementId },
      data: { status: 'COMPLETED' },
    });
    // Mark transaction as completed — delivery confirmed
    await tx.transaction.updateMany({
      where: { missionId, status: 'PENDING' },
      data: { status: 'COMPLETED' },
    });
  }

  /**
   * Événements à émettre après commit : broadcast de la preuve vers les
   * conversations liées, et rafraîchissement des stats des deux parties
   * quand la livraison est confirmée.
   */
  private async collectPostCommitEvents(
    tx: Prisma.TransactionClient,
    missionId: string,
    type: ProofType,
  ): Promise<ProofEvent[]> {
    const events: ProofEvent[] = [];

    const conversations = await tx.conversation.findMany({
      where: { missionId },
      select: { id: true },
    });
    events.push({
      name: 'proof.verified',
      payload: {
        missionId,
        type,
        conversationIds: conversations.map((c) => c.id),
      },
    });

    if (type === 'DELIVERY') {
      const completedMission = await tx.mission.findUnique({
        where: { id: missionId },
        select: { shipperId: true, carrierId: true },
      });
      if (completedMission) {
        events.push({
          name: 'stats.updated',
          payload: {
            userIds: [
              completedMission.shipperId,
              completedMission.carrierId,
            ].filter(Boolean),
          },
        });
      }
    }

    return events;
  }
}
