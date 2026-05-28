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

  // ─── Address reads ────────────────────────────────────────────────────────

  async findAll(where?: Prisma.AddressWhereInput, take = 50) {
    return this.address.findMany({ where, include: { city: true }, take });
  }

  async findBy(where: Prisma.AddressWhereUniqueInput) {
    return this.address.findUnique({ where, include: { city: true } });
  }

  async findOne({ where }: { where: Prisma.AddressWhereInput }) {
    return this.address.findFirst({ where, include: { city: true } });
  }

  // ─── City reads ───────────────────────────────────────────────────────────

  async findCities(search?: string, country?: string) {
    return this.city.findMany({
      where: {
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        ...(country
          ? { country: { contains: country, mode: 'insensitive' } }
          : {}),
      },
      take: 20,
      orderBy: { name: 'asc' },
    });
  }

  // ─── City upsert (race-condition safe) ───────────────────────────────────

  async createCityIfNotExist(dto: CreateCityDto) {
    return this.city.upsert({
      where: {
        name_countryIsoCode: {
          name: dto.name,
          countryIsoCode: dto.countryIsoCode,
        },
      },
      create: dto,
      update: {},
    });
  }

  // ─── Address upsert ───────────────────────────────────────────────────────

  async createIfNotExist<T extends Prisma.AddressSelect>(
    data: CreateFullAddressDto,
    returning?: T,
  ) {
    const { country, countryIsoCode, city, ...addressDto } = data;
    const { id: cityId } = await this.createCityIfNotExist({
      name: city,
      country,
      countryIsoCode,
    });

    const { latitude, longitude, ...rest } = addressDto;

    const existing = await this.address.findFirst({
      where: {
        OR: [
          { cityId, ...rest },
          ...(latitude && longitude
            ? [
                {
                  latitude: new Decimal(latitude).toDecimalPlaces(6),
                  longitude: new Decimal(longitude).toDecimalPlaces(6),
                },
              ]
            : []),
        ],
      },
      select: returning,
    });
    if (existing) return existing;

    try {
      const created = await this.address.create({
        data: { ...addressDto, cityId },
        select: returning ?? ({ id: true } as T),
      });
      if (latitude && longitude) {
        await this.databaseService.$executeRaw`
          UPDATE addresses
          SET location = ST_SetSRID(ST_MakePoint(${Number(longitude)}, ${Number(latitude)}), 4326)::geography
          WHERE id = ${(created as { id: string }).id}
        `;
      }
      return created as Prisma.AddressGetPayload<{ select: T }>;
    } catch (e) {
      if (e?.code === 'P2002') {
        return this.address.findFirst({
          where: {
            OR: [
              { cityId, ...rest },
              ...(latitude && longitude
                ? [
                    {
                      latitude: new Decimal(latitude).toDecimalPlaces(6),
                      longitude: new Decimal(longitude).toDecimalPlaces(6),
                    },
                  ]
                : []),
            ],
          },
          select: returning,
        });
      }
      throw e;
    }
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────

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
