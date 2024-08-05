import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class MissionsService {
  private missions: DatabaseService['mission'];
  constructor(private readonly databaseService: DatabaseService) {
    this.missions = this.databaseService.mission;
  }
  async findAll() {
    return this.missions.findMany({
      include: {
        advertisement: true,
        transaction: true,
        package: true,
        initiator: true,
      },
    });
  }
  async find(where: any) {
    return this.missions.findMany({ where });
  }
  async findUserMissions(userId: UUID) {
    return this.missions.findMany({
      where: { initiatorId: userId },
      include: {
        advertisement: true,
        transaction: true,
        package: true,
        initiator: true,
      },
    });
  }
  async findOne(id: UUID) {
    return this.missions.findFirst({ where: { id } });
  }
  async create(data: Prisma.MissionCreateInput) {
    return this.missions.create({ data });
  }
  async update(id: UUID, data: Prisma.MissionUpdateInput) {
    return this.missions.update({ where: { id }, data });
  }
  async delete(id: UUID) {
    return this.missions.delete({ where: { id } });
  }
}
