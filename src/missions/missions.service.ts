import { Injectable } from '@nestjs/common';
import { Mission, Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateMissionDto } from './dtos/create-mission.dto';
import { MissionQuery } from './dtos/mission-query.dto';
import { MISSION_DEFAULT_INCLUDE } from './entities/mission.entity';
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
  constructor(private readonly databaseService: DatabaseService) {
    this.missions = this.databaseService.mission;
    this.missionPackages = this.databaseService.missionPackage;
  }
  async findAll(where?: Prisma.MissionWhereInput) {
    return this.missions.findMany({ where, include: MISSION_WITH_ALL_FIELDS });
  }
  async find(where: any) {
    return this.missions.findMany({ where });
  }
  async findByUser(userId: UUID, where: MissionQuery) {
    return this.missions.findMany({
      where: {
        AND: [
          {
            OR: [{ shipperId: userId }, { carrierId: userId }],
            status: { not: 'PENDING' },
          },
          where,
        ],
      },
      include: { ...MISSION_DEFAULT_INCLUDE, shipper: true, carrier: true },
    });
  }
  async findOne(id: UUID) {
    return this.missions.findFirst({ where: { id } });
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
    console.log({ existingPackages, packageIds });
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
    return this.missions.update({ where: { id }, data });
  }
  async delete(id: UUID) {
    return this.missions.delete({ where: { id } });
  }
}
