import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateAddressDto } from './dtos/create-address.dto';
import { CreateCityDto } from './dtos/create-city-dto';
import { CreateFullAddressDto } from './dtos/create-full-address.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AddressesService {
  private address: DatabaseService['address'];
  private city: DatabaseService['city'];
  constructor(private readonly databaseService: DatabaseService) {
    this.address = this.databaseService.address;
    this.city = this.databaseService.city;
  }
  async findAll(where?: Prisma.AddressWhereInput) {
    return this.address.findMany({ where, include: { city: true } });
  }
  async findBy(where: Prisma.AddressWhereUniqueInput) {
    return this.address.findUnique({
      where,
      include: { city: true },
    });
  }
  async findOne({ where }: { where: Prisma.AddressWhereInput }) {
    return this.address.findFirst({
      where,
      include: { city: true },
    });
  }

  async createCityIfNotExist(dto?: CreateCityDto) {
    const city = await this.city.findFirst({
      where: dto,
    });

    if (city) return city;
    return this.city.create({ data: dto });
  }

  async createIfNotExist<T extends Prisma.AddressSelect>(
    data?: CreateFullAddressDto,
    returning?: T,
  ) {
    const { country, countryIsoCode, city, ...addressDto } = data;
    const { id: cityId } = await this.createCityIfNotExist({
      country,
      countryIsoCode,
      name: city,
    });
    const { latitude, longitude, ...rest } = addressDto;
    let existingAddress = await this.address.findFirst({
      where: {
        OR: [
          { cityId, ...rest },
          {
            latitude: new Decimal(latitude).toDecimalPlaces(6),
            longitude: new Decimal(longitude).toDecimalPlaces(6),
          },
        ],
      },
      select: returning,
    });
    if (!existingAddress) {
      existingAddress = await this.address.create({
        data: { ...addressDto, cityId },
        select: returning,
      });
    }

    return existingAddress;
  }

  async getCity(data: CreateCityDto) {
    const select = { id: true };
    let country = this.city.findFirst({ where: data, select });
    if (!country) {
      country = this.city.create({ data, select });
    }
    return country;
  }
  async getAddressInfo(data: {
    country: string;
    countryIsoCode: string;
    state?: string;
    city: string;
  }) {
    const { country, countryIsoCode, city } = data;

    const { id: cityId } = await this.getCity({
      name: city,
      country,
      countryIsoCode,
    });
    return { cityId };
  }
  async create(data: CreateAddressDto) {
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
