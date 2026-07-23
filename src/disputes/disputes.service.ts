import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { MissionsService } from 'src/missions/missions.service';
import { CreateDisputeDto } from './dtos/create-dispute.dto';
import { ResolveDisputeDto } from './dtos/resolve-dispute.dto';
import { GithubIssuesService } from './github-issues.service';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class DisputesService {
  private disputes: DatabaseService['missionDispute'];
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly missionsService: MissionsService,
    private readonly githubIssues: GithubIssuesService,
    private readonly emailService: EmailService,
  ) {
    this.disputes = this.db.missionDispute;
  }

  /**
   * Envoie un email à un utilisateur s'il existe et n'a pas coupé le canal
   * (preferences.notifyEmail). Jamais bloquant pour le flux appelant.
   */
  private async emailUser(
    userId: string | null | undefined,
    send: (
      email: string,
      firstName: string | null,
    ) => Promise<unknown> | unknown,
  ) {
    if (!userId) return;
    try {
      const user = await this.db.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          firstName: true,
          preferences: { select: { notifyEmail: true } },
        },
      });
      if (!user?.email || user.preferences?.notifyEmail === false) return;
      await send(user.email, user.firstName);
    } catch (err) {
      this.logger.warn(`Email litige non envoyé: ${err}`);
    }
  }

  // ─── Open a dispute — shipper or carrier ──────────────────────────────────

  async create(missionId: string, userId: string, data: CreateDisputeDto) {
    const mission = await this.db.mission.findUnique({
      where: { id: missionId },
      select: {
        status: true,
        shipperId: true,
        carrierId: true,
        advertisementId: true,
      },
    });

    if (!mission) throw new NotFoundException('Mission not found');
    if (userId !== mission.shipperId && userId !== mission.carrierId) {
      throw new ForbiddenException();
    }
    if (!['ACCEPTED', 'IN_TRANSIT'].includes(mission.status)) {
      throw new BadRequestException(
        `Cannot open a dispute on a mission with status ${mission.status}`,
      );
    }

    let result: [Awaited<ReturnType<typeof this.disputes.create>>, unknown];
    try {
      result = await this.db.$transaction([
        this.disputes.create({
          data: {
            missionId,
            openedById: userId,
            reason: data.reason,
            description: data.description,
          },
        }),
        this.db.mission.update({
          where: { id: missionId },
          data: { status: 'DISPUTED' },
        }),
      ]);
    } catch (e) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'A dispute is already open for this mission',
        );
      }
      throw e;
    }

    // Effets de bord du passage en DISPUTED (broadcast temps réel notamment) —
    // mutualisés avec MissionsService.
    await this.missionsService.applyStatusSideEffects({
      id: missionId,
      advertisementId: mission.advertisementId,
      status: 'DISPUTED',
    });

    // L'autre partie n'est pas forcément connectée : email d'information.
    const otherPartyId =
      userId === mission.shipperId ? mission.carrierId : mission.shipperId;
    void this.emailUser(otherPartyId, (email, firstName) =>
      this.emailService.sendDisputeOpened(email, {
        firstName,
        missionId,
        reason: data.reason,
      }),
    );

    // Suivi équipe : une issue GitHub par litige (le toast « notre équipe a
    // été notifiée » devient vrai). Jamais bloquant pour l'ouverture. Le
    // numéro d'issue est persisté pour pouvoir la fermer à la résolution.
    const [dispute] = result;
    void this.githubIssues
      .createDisputeIssue({
        disputeId: dispute.id,
        missionId,
        reason: data.reason,
        description: data.description,
        openedBy: userId === mission.shipperId ? 'shipper' : 'carrier',
      })
      .then((issueNumber) =>
        issueNumber == null
          ? undefined
          : this.disputes.update({
              where: { id: dispute.id },
              data: { githubIssueNumber: issueNumber },
            }),
      )
      .catch((err) => this.logger.warn(`Issue litige non créée: ${err}`));

    return result;
  }

  // ─── Admin: resolve a dispute ─────────────────────────────────────────────

  async resolve(id: string, adminId: string, data: ResolveDisputeDto) {
    const dispute = await this.disputes.findUnique({
      where: { id },
      include: {
        mission: {
          select: {
            advertisementId: true,
            status: true,
            shipperId: true,
            carrierId: true,
          },
        },
      },
    });

    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.status === 'RESOLVED') {
      throw new BadRequestException('This dispute is already resolved');
    }

    // Verrou optimiste : le WHERE porte le statut OPEN — si deux résolutions
    // concourent, une seule écrit (count=1), l'autre reçoit le 400 au lieu
    // d'écraser la première (le check-then-act ci-dessus laissait la fenêtre).
    const updatedDispute = await this.db.$transaction(async (tx) => {
      const { count } = await tx.missionDispute.updateMany({
        where: { id, status: 'OPEN' },
        data: {
          status: 'RESOLVED',
          resolution: data.resolution,
          resolvedById: adminId,
          resolvedAt: new Date(),
        },
      });
      if (count === 0) {
        throw new BadRequestException('This dispute is already resolved');
      }
      await tx.mission.update({
        where: { id: dispute.missionId },
        data: { status: data.missionOutcome },
      });
      return tx.missionDispute.findUnique({ where: { id } });
    });

    // MAJ annonce + annulation des transactions en attente + archivage des
    // conversations + broadcast — mutualisés avec MissionsService (notamment
    // l'annulation des transactions PENDING, oubliée dans l'ancienne version).
    await this.missionsService.applyStatusSideEffects({
      id: dispute.missionId,
      advertisementId: dispute.mission.advertisementId,
      status: data.missionOutcome,
    });

    // Les deux parties sont informées de l'issue du litige par email.
    for (const partyId of [
      dispute.mission.shipperId,
      dispute.mission.carrierId,
    ]) {
      void this.emailUser(partyId, (email, firstName) =>
        this.emailService.sendDisputeResolved(email, {
          firstName,
          missionId: dispute.missionId,
          resolution: data.resolution,
          missionOutcome: data.missionOutcome,
        }),
      );
    }

    // Boucle de suivi complète : l'issue GitHub ouverte à la création est
    // commentée (texte de résolution) puis fermée. Jamais bloquant.
    if (dispute.githubIssueNumber != null) {
      void this.githubIssues
        .closeDisputeIssue({
          issueNumber: dispute.githubIssueNumber,
          resolution: data.resolution,
          missionOutcome: data.missionOutcome,
        })
        .catch((err) => this.logger.warn(`Issue litige non fermée: ${err}`));
    }

    return updatedDispute;
  }

  // ─── User: own dispute for a mission ─────────────────────────────────────

  async findByMission(missionId: string, userId: string) {
    const mission = await this.db.mission.findFirst({
      where: {
        id: missionId,
        OR: [{ shipperId: userId }, { carrierId: userId }],
      },
      select: { id: true },
    });
    if (!mission) throw new ForbiddenException();
    return this.disputes.findUnique({ where: { missionId } });
  }
}
