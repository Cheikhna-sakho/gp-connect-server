import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AddressesService {
  private address: DatabaseService['address'];
  constructor(private readonly databaseService: DatabaseService) {
    this.address = this.databaseService.address;
  }
  async findAll() {
    return this.address.findMany();
  }
  async findBy(where: Prisma.AddressWhereUniqueInput) {
    return this.address.findUnique({
      where,
    });
  }
  async findOne({ where }: { where: Prisma.AddressWhereInput }) {
    return this.address.findFirst({
      where,
    });
  }
  async create(data: Prisma.AddressCreateInput) {
    return this.address.create({ data });
  }
  async update({
    where,
    data,
  }: {
    where: Prisma.AddressWhereUniqueInput;
    data: Prisma.AddressUpdateInput;
  }) {
    return this.address.update({ where, data });
  }
  async delete(id: UUID) {
    return this.address.delete({ where: { id } });
  }
}
