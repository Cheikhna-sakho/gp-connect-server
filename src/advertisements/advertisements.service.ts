import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateAdvertisementDto } from './dtos/create-advertisements.dto';
import { FULL_ADDRESS_INCLUDES_FIELDS } from 'src/addresses/constants/full-address.const';

type Find = { where: Prisma.AdvertisementWhereInput };
type FindOne = {
  where: Prisma.AdvertisementWhereInput;
  select?: Prisma.AdvertisementSelect;
};
type FindUnique = Prisma.AdvertisementWhereUniqueInput;
type Update = {
  data: Prisma.AdvertisementUpdateInput;
  where: Prisma.AdvertisementWhereUniqueInput;
};
type UpdateBy = Prisma.AdvertisementUpdateInput;
type Delete = { where: Prisma.AdvertisementWhereUniqueInput };
// const FULL_ADDRESS_INCLUDES_FIELDS = { include: { city: true } };
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
    return this.advertisements.findFirst({
      where,
      include: {
        author: true,
        departure: FULL_ADDRESS_INCLUDES_FIELDS,
        destination: FULL_ADDRESS_INCLUDES_FIELDS,
      },
    });
  }
  async findOne({ where, select }: FindOne) {
    return this.advertisements.findFirst({ where, select });
  }
  async findAll(where?: Prisma.AdvertisementWhereInput) {
    return this.advertisements.findMany({
      where,
      include: {
        author: true,
        departure: FULL_ADDRESS_INCLUDES_FIELDS,
        destination: FULL_ADDRESS_INCLUDES_FIELDS,
      },
    });
  }

  async create(dto: CreateAdvertisementDto) {
    const { destinationId, departureId, authorId, ...data } = dto;

    return this.advertisements.create({
      data: {
        ...data,
        arrivalDate: new Date(data.arrivalDate),
        departureDate: new Date(data.departureDate),
        author: { connect: { id: authorId } },
        departure: {
          connect: { id: departureId },
        },
        destination: {
          connect: { id: destinationId },
        },
      },
    });
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
