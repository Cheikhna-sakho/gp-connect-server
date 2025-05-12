import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateAddressDto } from './dtos/create-address.dto';
import { CreateCityDto } from './dtos/create-city-dto';
import { CreateCountryDto } from './dtos/create-country.dto';
import { CreateFullAddressDto } from './dtos/create-full-address.dto';
import { CreateStateDto } from './dtos/create-state.dto';

@Injectable()
export class AddressesService {
  private address: DatabaseService['address'];
  private city: DatabaseService['city'];
  private country: DatabaseService['country'];
  private state: DatabaseService['state'];
  constructor(private readonly databaseService: DatabaseService) {
    this.address = this.databaseService.address;
    this.city = this.databaseService.city;
    this.city = this.databaseService.city;
    this.state = this.databaseService.state;
  }
  async findAll(where?: Prisma.AddressWhereInput) {
    return this.address.findMany({ where, include: { city: true } });
  }
  async findBy(where: Prisma.AddressWhereUniqueInput) {
    return this.address.findUnique({
      where,
      include: { city: { include: { country: true } } },
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
  async createCountryIfNotExist(dto?: CreateCountryDto) {
    const country = await this.country.findFirst({
      where: dto,
    });
    if (country) return country;
    return this.country.create({ data: dto });
  }
  async createStateIfNotExist(dto?: CreateStateDto) {
    const state = await this.state.findFirst({
      where: dto,
    });
    if (state) return state;
    return this.state.create({ data: dto });
  }
  async createIfNotExist<T extends Prisma.AddressSelect>(
    data?: CreateFullAddressDto,
    returning?: T,
  ) {
    const { country, city, state, ...addressDto } = data;
    const { id: countryId } = await this.createCountryIfNotExist(country);
    const { id: cityId } = await this.createCityIfNotExist({
      countryId,
      name: city,
    });
    if (state) await this.createStateIfNotExist({ countryId, name: state });

    let existingAddress = await this.address.findFirst({
      where: { OR: [{ cityId, ...addressDto }] },
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
  async getCountry(data: { name: string; isoCode: string }) {
    const select = { id: true };
    let country = this.country.findFirst({ where: data, select });
    if (!country) {
      country = this.country.create({ data, select });
    }
    return country;
  }
  async getState(data: { name: string; countryId: string }) {
    const select = { id: true };
    let country = this.state.findFirst({ where: data, select });
    if (!country) {
      country = this.state.create({ data, select });
    }
    return country;
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
    isoCode: string;
    state?: string;
    city: string;
  }) {
    const { country, isoCode, state, city } = data;
    let stateId: string;
    const { id: countryId } = await this.getCountry({
      name: country,
      isoCode: isoCode,
    });
    if (state) {
      ({ id: stateId } = await this.getState({
        name: state,
        countryId: countryId,
      }));
    }
    const { id: cityId } = await this.getCity({
      name: city,
      stateId: stateId,
      countryId,
    });
    return { countryId, stateId, cityId };
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
