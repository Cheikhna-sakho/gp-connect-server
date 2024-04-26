import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
type Find = { where: Prisma.PackageWhereInput };
type FindOne = { where: Prisma.PackageWhereInput };
type FindUnique = Prisma.PackageWhereUniqueInput;
type Create = { data: Prisma.PackageCreateInput };
type Update = {
  data: Prisma.PackageUpdateInput;
  where: Prisma.PackageWhereUniqueInput;
};
type UpdateBy = Prisma.PackageUpdateInput;

type Delete = { where: Prisma.PackageWhereUniqueInput };

@Injectable()
export class PackagesService {
  private packages: DatabaseService['package'];

  constructor(private readonly databaseService: DatabaseService) {
    this.packages = this.databaseService.package;
  }
  async findBy(where: FindUnique) {
    return this.packages.findFirst({ where });
  }
  async find({ where }: Find) {
    return this.packages.findFirst({ where });
  }
  async findOne({ where }: FindOne) {
    return this.packages.findFirst({ where });
  }
  async findAll() {
    return this.packages.findMany();
  }
  async create({ data }: Create) {
    return this.packages.create({ data });
  }
  async updateWhere({ data, where }: Update) {
    return this.packages.update({ where, data });
  }
  async updateById(id: string, data: UpdateBy) {
    return this.packages.update({ where: { id }, data });
  }
  async delete(where: Delete) {
    this.packages.delete(where);
  }
}
