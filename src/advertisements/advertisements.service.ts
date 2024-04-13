import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

type Find = { where: Prisma.AdvertisementWhereInput };
type FindOne = { where: Prisma.AdvertisementWhereInput };
type FindUnique = Prisma.AdvertisementWhereUniqueInput;
type Create = { data: Prisma.AdvertisementCreateInput };
type Update = {
  data: Prisma.AdvertisementUpdateInput;
  where: Prisma.AdvertisementWhereUniqueInput;
};
type UpdateBy = Prisma.AdvertisementUpdateInput;
type Delete = { where: Prisma.AdvertisementWhereUniqueInput };

@Injectable()
export class AdvertisementsService {
  private advertisements: DatabaseService['advertisement'];
  constructor(private readonly databaseService: DatabaseService) {
    this.advertisements = this.databaseService.advertisement;
  }
  async find({ where }: Find) {
    return this.advertisements.findFirst({ where });
  }
  async findBy(where?: FindUnique) {
    return this.advertisements.findFirst({ where });
  }
  async findOne({ where }: FindOne) {
    return this.advertisements.findFirst({ where });
  }
  async findAll() {
    return this.advertisements.findMany();
  }
  async create({ data }: Create) {
    return this.advertisements.create({ data });
  }
  async update({ data, where }: Update) {
    return this.advertisements.update({ where, data });
  }
  async updateById(id: string, data: UpdateBy) {
    return this.advertisements.update({ where: { id }, data });
  }
  async delete(where: Delete) {
    this.advertisements.delete(where);
  }
}
