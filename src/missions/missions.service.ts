import { Injectable } from '@nestjs/common';
import { Mission, Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateMissionDto } from './dtos/missions.dto';
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
  'package',
  'initiator',
]);
@Injectable()
export class MissionsService {
  private missions: DatabaseService['mission'];
  constructor(private readonly databaseService: DatabaseService) {
    this.missions = this.databaseService.mission;
  }
  async findAll() {
    return this.missions.findMany({ include: MISSION_WITH_ALL_FIELDS });
  }
  async find(where: any) {
    return this.missions.findMany({ where });
  }
  async findUserMissions(userId: UUID) {
    return this.missions.findMany({
      where: { initiatorId: userId },
      include: MISSION_WITH_ALL_FIELDS,
    });
  }
  async findOne(id: UUID) {
    return this.missions.findFirst({ where: { id } });
  }
  async create(data: CreateMissionDto) {
    const { advertisementId, packageId, initiatorId } = data;
    return this.missions.create({
      data: {
        advertisement: { connect: { id: advertisementId } },
        package: { connect: { id: packageId } },
        initiator: { connect: { id: initiatorId } },
      },
    });
  }
  async update(id: UUID, data: Prisma.MissionUpdateInput) {
    return this.missions.update({ where: { id }, data });
  }
  async delete(id: UUID) {
    return this.missions.delete({ where: { id } });
  }
}
