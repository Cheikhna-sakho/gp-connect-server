import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProofType } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { generateOtp, verifyOtp } from 'src/common/utils/otp.util';
import { ProofDto } from './dtos/proof.dto';
import { MediasService } from 'src/medias/medias.service';

@Injectable()
export class ProofService {
  private proofs: DatabaseService['missionProof'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mediasService: MediasService,
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
      update: { otpHash: hash, otpExpiresAt: expiresAt, otpUsedAt: null },
    });

    return { code: plain, expiresAt };
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
    const proof = await this.proofs.findUnique({
      where: { missionId_type: { missionId, type } },
    });

    if (!proof) {
      throw new NotFoundException(
        'No proof found — ask the shipper to generate a code first',
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

    const isValid = await verifyOtp({ hash: proof.otpHash, plain: code });
    if (!isValid) throw new BadRequestException('Invalid code');

    return this.databaseService.$transaction(async (tx) => {
      await tx.missionProof.update({
        where: { id: proof.id },
        data: { otpUsedAt: new Date(), verifiedById },
      });

      const missionPackages = await tx.missionPackage.findMany({
        where: { missionId },
        select: { packageId: true },
      });
      const packageIds = missionPackages.map((mp) => mp.packageId);

      if (type === 'PICKUP') {
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

      if (type === 'DELIVERY') {
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

      const updatedProof = await tx.missionProof.findUnique({
        where: { id: proof.id },
      });

      // Broadcast proof verification event to all linked conversation rooms
      const conversations = await tx.conversation.findMany({
        where: { missionId },
        select: { id: true },
      });
      this.eventEmitter.emit('proof.verified', {
        missionId,
        type,
        conversationIds: conversations.map((c) => c.id),
      });

      // When delivery is confirmed, both carrier and shipper stats change
      if (type === 'DELIVERY') {
        const completedMission = await tx.mission.findUnique({
          where: { id: missionId },
          select: { shipperId: true, carrierId: true },
        });
        if (completedMission) {
          this.eventEmitter.emit('stats.updated', {
            userIds: [
              completedMission.shipperId,
              completedMission.carrierId,
            ].filter(Boolean),
          });
        }
      }

      return updatedProof;
    });
  }
}
