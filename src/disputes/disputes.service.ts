import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdvertisementStatus } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateDisputeDto } from './dtos/create-dispute.dto';
import { ResolveDisputeDto } from './dtos/resolve-dispute.dto';

@Injectable()
export class DisputesService {
  private disputes: DatabaseService['missionDispute'];

  constructor(private readonly db: DatabaseService) {
    this.disputes = this.db.missionDispute;
  }

  // ─── Open a dispute — shipper or carrier ──────────────────────────────────

  async create(missionId: string, userId: string, data: CreateDisputeDto) {
    const mission = await this.db.mission.findUnique({
      where: { id: missionId },
      select: { status: true, shipperId: true, carrierId: true },
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

    try {
      return await this.db.$transaction([
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
        throw new ConflictException('A dispute is already open for this mission');
      }
      throw e;
    }
  }

  // ─── Admin: list all open disputes ────────────────────────────────────────

  findAll(status?: 'OPEN' | 'RESOLVED') {
    return this.disputes.findMany({
      where: status ? { status } : undefined,
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        resolvedBy: { select: { id: true, firstName: true, lastName: true } },
        mission: { select: { id: true, status: true, shipperId: true, carrierId: true, advertisementId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Admin: resolve a dispute ─────────────────────────────────────────────

  async resolve(id: string, adminId: string, data: ResolveDisputeDto) {
    const dispute = await this.disputes.findUnique({
      where: { id },
      include: { mission: { select: { advertisementId: true, status: true } } },
    });

    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.status === 'RESOLVED') {
      throw new BadRequestException('This dispute is already resolved');
    }

    const adStatus: AdvertisementStatus =
      data.missionOutcome === 'COMPLETED'
        ? AdvertisementStatus.COMPLETED
        : AdvertisementStatus.OPEN;

    const [updatedDispute] = await this.db.$transaction([
      this.disputes.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolution: data.resolution,
          resolvedById: adminId,
          resolvedAt: new Date(),
        },
      }),
      this.db.mission.update({
        where: { id: dispute.missionId },
        data: { status: data.missionOutcome },
      }),
      this.db.advertisement.update({
        where: { id: dispute.mission.advertisementId },
        data: { status: adStatus },
      }),
      // Archive all conversations linked to this mission
      this.db.conversation.updateMany({
        where: { missionId: dispute.missionId },
        data: { status: 'ARCHIVED' },
      }),
    ]);

    return updatedDispute;
  }

  // ─── User: own dispute for a mission ─────────────────────────────────────

  async findByMission(missionId: string, userId: string) {
    const mission = await this.db.mission.findFirst({
      where: { id: missionId, OR: [{ shipperId: userId }, { carrierId: userId }] },
      select: { id: true },
    });
    if (!mission) throw new ForbiddenException();
    return this.disputes.findUnique({ where: { missionId } });
  }
}
