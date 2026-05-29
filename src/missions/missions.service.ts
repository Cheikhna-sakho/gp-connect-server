import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AdvertisementStatus,
  Mission,
  MissionStatus,
  Prisma,
} from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateMissionDto } from './dtos/create-mission.dto';
import { MissionQuery } from './dtos/mission-query.dto';
import {
  MISSION_DEFAULT_INCLUDE,
  MISSION_DETAIL_INCLUDE,
} from './entities/mission.entity';
import { USER_DEFAULT_INCLUDE } from 'src/users/entities/user.entity';
import { MissionPartial } from './dtos/mission-partial.dto';
const getSelectFields = <T extends string>(fields: T[]) => {
  return fields.reduce(
    (selectedFields, field) => {
      selectedFields[field] = true;
      return selectedFields;
    },
    {} as Record<T, true>,
  );
};
const getMissionFields = <
  T extends keyof Mission | keyof Prisma.MissionInclude,
>(
  s: T[],
) => getSelectFields(s);
const MISSION_WITH_ALL_FIELDS = getMissionFields([
  'advertisement',
  'transaction',
  'packages',
  'shipper',
]);
@Injectable()
export class MissionsService {
  private missions: DatabaseService['mission'];
  private missionPackages: DatabaseService['missionPackage'];
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.missions = this.databaseService.mission;
    this.missionPackages = this.databaseService.missionPackage;
  }
  async findAll(where?: Prisma.MissionWhereInput) {
    return this.missions.findMany({ where, include: MISSION_WITH_ALL_FIELDS });
  }
  async find(where: Prisma.MissionWhereInput) {
    return this.missions.findMany({ where });
  }
  async findByUser(userId: UUID, { page, limit, ...where }: MissionQuery) {
    const safeLimit = Math.min(limit ?? 20, 50);
    const skip = ((page ?? 1) - 1) * safeLimit;

    const baseWhere = {
      AND: [
        {
          OR: [{ shipperId: userId }, { carrierId: userId }],
          status: { not: 'PENDING' as const },
        },
        where,
      ],
    };

    const [data, total] = await Promise.all([
      this.missions.findMany({
        where: baseWhere,
        include: { ...MISSION_DEFAULT_INCLUDE, shipper: true, carrier: true },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.missions.count({ where: baseWhere }),
    ]);

    return {
      data,
      meta: {
        total,
        page: page ?? 1,
        limit: safeLimit,
        pages: Math.ceil(total / safeLimit),
      },
    };
  }
  async findOne(id: UUID) {
    return this.missions.findFirst({ where: { id } });
  }

  async findOneForUser(id: string, userId: string) {
    return this.missions.findFirst({
      where: { id, OR: [{ shipperId: userId }, { carrierId: userId }] },
      include: {
        ...MISSION_DETAIL_INCLUDE,
        shipper: { include: USER_DEFAULT_INCLUDE },
        carrier: { include: USER_DEFAULT_INCLUDE },
      },
    });
  }
  async create(data: CreateMissionDto) {
    const { advertisementId, packageIds, shipperId } = data;
    const joinFields = {
      packages:
        undefined as Prisma.MissionPackageCreateNestedManyWithoutMissionInput,
    };
    if (packageIds?.length) {
      joinFields.packages = {
        createMany: { data: packageIds.map((packageId) => ({ packageId })) },
      };
    }
    return this.missions.create({
      data: {
        advertisement: { connect: { id: advertisementId } },
        shipper: { connect: { id: shipperId } },
        ...joinFields,
      },
    });
  }

  async addPackages(missionId: string, packageIds: string[]) {
    const existingPackages = await this.missionPackages.findMany({
      where: { missionId },
      select: { packageId: true },
    });
    const existingIds = new Set(existingPackages.map((p) => p.packageId));
    return this.missionPackages.createMany({
      data: packageIds
        .filter((p) => !existingIds.has(p))
        .map((packageId) => ({ packageId, missionId })),
    });
  }

  async removePackage(missionId: string, packageId: string) {
    return this.missionPackages.delete({
      where: {
        missionId_packageId: { missionId, packageId },
      },
    });
  }

  async update(id: UUID, data: MissionPartial) {
    if (data.status) {
      await this.validateStatusTransition(
        id as string,
        data.status as MissionStatus,
      );
    }

    const mission = await this.missions.update({ where: { id }, data });

    if (data.status) {
      const adStatus: AdvertisementStatus | null =
        data.status === 'ACCEPTED'
          ? AdvertisementStatus.IN_PROGRESS
          : data.status === 'IN_TRANSIT'
            ? AdvertisementStatus.IN_PROGRESS
            : data.status === 'COMPLETED'
              ? AdvertisementStatus.COMPLETED
              : data.status === 'CANCELLED'
                ? AdvertisementStatus.OPEN
                : null;

      if (adStatus) {
        await this.databaseService.advertisement.update({
          where: { id: mission.advertisementId },
          data: { status: adStatus },
        });
      }

      if (data.status === 'CANCELLED') {
        await this.databaseService.transaction.updateMany({
          where: { missionId: mission.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      }

      // Auto-archive conversations when mission ends
      if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
        await this.databaseService.conversation.updateMany({
          where: { missionId: mission.id },
          data: { status: 'ARCHIVED' },
        });
      }

      // Broadcast mission status change to all linked conversation rooms
      const conversations = await this.databaseService.conversation.findMany({
        where: { missionId: mission.id },
        select: { id: true },
      });
      this.eventEmitter.emit('mission.status-changed', {
        missionId: mission.id,
        status: mission.status,
        conversationIds: conversations.map((c) => c.id),
      });
    }

    return mission;
  }

  private async validateStatusTransition(id: string, next: MissionStatus) {
    const mission = await this.missions.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!mission) return;

    const allowed: Record<MissionStatus, MissionStatus[]> = {
      PENDING: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['IN_TRANSIT', 'CANCELLED', 'DISPUTED'],
      // No CANCELLED from IN_TRANSIT — carrier has the package, must dispute first
      IN_TRANSIT: ['COMPLETED', 'DISPUTED'],
      COMPLETED: [],
      CANCELLED: [],
      DISPUTED: ['CANCELLED', 'COMPLETED'],
    };

    if (!allowed[mission.status].includes(next)) {
      throw new BadRequestException(
        `Cannot transition mission from ${mission.status} to ${next}`,
      );
    }
  }
  async verifyPackagesOwnership(
    packageIds: string[],
    ownerId: string,
  ): Promise<boolean> {
    const count = await this.databaseService.package.count({
      where: { id: { in: packageIds }, ownerId },
    });
    return count === packageIds.length;
  }

  async delete(id: UUID) {
    return this.missions.delete({ where: { id } });
  }
}
