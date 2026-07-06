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

  // Écrit le point PostGIS `location` (utilisé par la recherche d'annonces par
  // rayon, ST_DWithin). À appeler après toute écriture de latitude/longitude.
  private async setLocation(id: string, latitude: number, longitude: number) {
    await this.databaseService.$executeRaw`
      UPDATE addresses
      SET location = ST_SetSRID(ST_MakePoint(${Number(longitude)}, ${Number(latitude)}), 4326)::geography
      WHERE id = ${id}
    `;
  }

  /**
   * Clé de déduplication d'une adresse :
   *  - si on a des coordonnées → on déduplique dessus (= la clé unique réelle) ;
   *  - sinon, sur l'identité textuelle COMPLÈTE (ville + rue + zip), et
   *    uniquement si une rue est fournie — sinon « ville seule » matcherait
   *    n'importe quelle adresse de la ville.
   */
  private dedupWhere(
    cityId: string,
    rest: { street?: string; zipCode?: string },
    latitude?: number,
    longitude?: number,
  ): Prisma.AddressWhereInput | null {
    if (latitude != null && longitude != null) {
      return {
        latitude: new Decimal(latitude).toDecimalPlaces(6),
        longitude: new Decimal(longitude).toDecimalPlaces(6),
      };
    }
    if (rest.street) {
      return { cityId, street: rest.street, zipCode: rest.zipCode ?? null };
    }
    return null;
  }

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
    const where = this.dedupWhere(cityId, rest, latitude, longitude);

    if (where) {
      const existing = await this.address.findFirst({
        where,
        select: returning,
      });
      if (existing) return existing;
    }

    try {
      const created = await this.address.create({
        data: { ...addressDto, cityId },
        select: returning ?? ({ id: true } as T),
      });
      if (latitude != null && longitude != null) {
        await this.setLocation(
          (created as { id: string }).id,
          latitude,
          longitude,
        );
      }
      return created as Prisma.AddressGetPayload<{ select: T }>;
    } catch (e) {
      if (e?.code === 'P2002' && where) {
        return this.address.findFirst({ where, select: returning });
      }
      throw e;
    }
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────

  async create(data: CreateAddressDto) {
    const address = await this.address.create({ data });
    if (data.latitude != null && data.longitude != null) {
      await this.setLocation(address.id, data.latitude, data.longitude);
    }
    return address;
  }

  async update({
    where,
    data,
  }: {
    where: Prisma.AddressWhereUniqueInput;
    data: Prisma.AddressUpdateInput;
  }) {
    const address = await this.address.update({ where, data });
    // Garder le point PostGIS cohérent quand l'admin modifie les coordonnées.
    const lat = typeof data.latitude === 'number' ? data.latitude : undefined;
    const lng = typeof data.longitude === 'number' ? data.longitude : undefined;
    if (lat != null && lng != null) {
      await this.setLocation(address.id, lat, lng);
    }
    return address;
  }

  async delete(id: UUID) {
    return this.address.delete({ where: { id } });
  }
}
