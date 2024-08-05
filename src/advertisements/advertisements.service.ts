import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateAdvertisementDto } from './dtos/advertisements.dto';

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

@Injectable()
export class AdvertisementsService {
  private advertisements: DatabaseService['advertisement'];
  private addresses: DatabaseService['address'];
  constructor(private readonly databaseService: DatabaseService) {
    this.advertisements = this.databaseService.advertisement;
    this.addresses = this.databaseService.address;
  }
  async findOrCreateAddress({
    id,
    address,
  }: {
    id?: string;
    address?: Prisma.AddressCreateInput;
  }) {
    const { id: idExist } =
      (await this.addresses.findFirst({
        where: {
          OR: [{ id }, { city: address.city, country: address.country }],
        },
        select: { id: true },
      })) ?? {};
    if (!idExist) {
      const { id: newId } = await this.addresses.create({
        data: address,
        select: { id: true },
      });
      return newId;
    }
    return idExist;
  }
  async find({ where }: Find) {
    return this.advertisements.findFirst({ where });
  }
  async findBy(where?: FindUnique) {
    return this.advertisements.findFirst({
      where,
      include: {
        author: true,
        departure: true,
        destination: true,
      },
    });
  }
  async findOne({ where, select }: FindOne) {
    return this.advertisements.findFirst({ where, select });
  }
  async findAll() {
    return this.advertisements.findMany({
      include: { author: true, departure: true, destination: true },
    });
  }
  async findPackages(id: UUID) {
    return this.advertisements.findUnique({
      where: { id },
      select: { missions: { select: { package: true } } },
    });
  }
  async create(dto: CreateAdvertisementDto) {
    const { destinationId, departureId, authorId, ...data } = dto;
    const departure = await this.findOrCreateAddress({
      id: departureId,
      address: data.departure,
    });
    const destination = await this.findOrCreateAddress({
      id: destinationId,
      address: data.destination,
    });
    return this.advertisements.create({
      data: {
        ...data,
        arrivalDate: new Date(data.arrivalDate),
        departureDate: new Date(data.departureDate),
        author: { connect: { id: authorId } },
        departure: {
          connect: { id: departure },
        },
        destination: {
          connect: { id: destination },
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
