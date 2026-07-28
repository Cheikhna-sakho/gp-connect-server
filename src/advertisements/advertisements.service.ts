import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdvertisementStatus, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { DatabaseService } from 'src/database/database.service';
import { CreateAdvertisementDto } from './dtos/create-advertisements.dto';
import { AdvertisementQueryFindDto } from './dtos/advertisements-query-find.dto';
import {
  ADVERTISEMENT_CONVERSATION_INCLUDE,
  ADVERTISEMENT_DEFAULT_INCLUDE,
} from './entities/advertisement.entity';
import { PublicUserEntity } from 'src/users/entities/public-user.entity';

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
type Delete = { where: Prisma.AdvertisementWhereUniqueInput };
type Pagination = { page?: number; limit?: number };

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
    return this.advertisements.findUnique({
      where,
      include: {
        ...ADVERTISEMENT_DEFAULT_INCLUDE,
        conversations: ADVERTISEMENT_CONVERSATION_INCLUDE,
      },
    });
  }

  // Lecture publique : surtout PAS les conversations (sinon l'entity dérive et
  // expose les offres + l'identité des enchérisseurs). Les offres restent
  // réservées à l'auteur via findOffers (GET /:id/offers).
  async findPublic(id: string) {
    return this.advertisements.findUnique({
      where: { id },
      include: ADVERTISEMENT_DEFAULT_INCLUDE,
    });
  }

  async findOne({ where, select }: FindOne) {
    return this.advertisements.findFirst({ where, select });
  }

  async findAll(
    where?: Prisma.AdvertisementWhereInput,
    { page = 1, limit = 20 }: Pagination = {},
    orderBy: Prisma.AdvertisementOrderByWithRelationInput = {
      createdAt: 'desc',
    },
    withOffers = false,
  ) {
    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;

    const include = withOffers
      ? {
          ...ADVERTISEMENT_DEFAULT_INCLUDE,
          conversations: ADVERTISEMENT_CONVERSATION_INCLUDE,
        }
      : ADVERTISEMENT_DEFAULT_INCLUDE;

    const [data, total] = await Promise.all([
      this.advertisements.findMany({
        where,
        include,
        orderBy,
        skip,
        take: safeLimit,
      }),
      this.advertisements.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit: safeLimit,
        pages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findNearbyIds(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<string[]> {
    const radiusMeters = radiusKm * 1000;
    const rows = await this.databaseService.$queryRaw<{ id: string }[]>`
      SELECT ad.id
      FROM advertisements ad
      JOIN addresses a ON a.id = ad.departure_id
      WHERE a.location IS NOT NULL
        AND ST_DWithin(
          a.location,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
    `;
    return rows.map((r) => r.id);
  }

  /**
   * Recherche publique : annonces OPEN non expirées, filtres du DTO traduits
   * en clauses Prisma (prix max, poids min, villes, rayon PostGIS).
   */
  async searchPublic(query: AdvertisementQueryFindDto) {
    const {
      page,
      limit,
      maxWeight,
      price,
      arrivalDate,
      departureCityName,
      destinationCityName,
      lat,
      lng,
      radius,
      sortBy,
      order,
      ...where
    } = query;

    // Exclure les annonces expirées (date d'arrivée passée). Si le client
    // fournit aussi un filtre arrivalDate, on garde la borne la plus restrictive.
    const now = new Date();
    const arrivalFloor =
      arrivalDate && new Date(arrivalDate) > now ? arrivalDate : now;

    const prismaWhere: Record<string, any> = {
      ...where,
      status: 'OPEN' as const,
      // "Prix max" → annonces dont le prix est ≤ à la valeur saisie
      ...(price ? { price: { lte: price } } : {}),
      // "Poids min dispo" → annonces dont la capacité est ≥ à la valeur saisie
      ...(maxWeight ? { maxWeight: { gte: maxWeight } } : {}),
      // Annonces dont la date d'arrivée est >= max(maintenant, date saisie)
      arrivalDate: { gte: arrivalFloor },
      ...this.cityFilter('departure', departureCityName),
      ...this.cityFilter('destination', destinationCityName),
    };

    // Filtre géospatial PostGIS : restreindre aux annonces dont la ville de
    // départ est dans le rayon défini (défaut 100 km)
    if (lat !== undefined && lng !== undefined) {
      prismaWhere.id = {
        in: await this.findNearbyIds(lat, lng, radius ?? 100),
      };
    }

    return this.findAll(
      prismaWhere,
      { page, limit },
      this.buildOrderBy(sortBy, order, { createdAt: 'desc' }),
    );
  }

  /** Annonces de l'auteur (offres incluses), authorId imposé par le token. */
  async searchMine(authorId: string, query: AdvertisementQueryFindDto) {
    const {
      page,
      limit,
      arrivalDate,
      departureCityName,
      destinationCityName,
      sortBy,
      order,
      ...where
    } = query;

    const prismaWhere = {
      ...where,
      authorId, // après le spread : non surchargeable par un ?authorId= en query
      ...(arrivalDate ? { arrivalDate: { gte: arrivalDate } } : {}),
      ...this.cityFilter('departure', departureCityName),
      ...this.cityFilter('destination', destinationCityName),
    };

    return this.findAll(
      prismaWhere,
      { page, limit },
      this.buildOrderBy(sortBy, order, { arrivalDate: 'asc' }),
      true,
    );
  }

  /** Filtre « le nom de ville contient » (insensible à la casse). */
  private cityFilter(field: 'departure' | 'destination', name?: string) {
    if (!name) return {};
    return {
      [field]: {
        city: { name: { contains: name, mode: 'insensitive' as const } },
      },
    };
  }

  private buildOrderBy(
    sortBy: AdvertisementQueryFindDto['sortBy'],
    order: AdvertisementQueryFindDto['order'],
    fallback: Prisma.AdvertisementOrderByWithRelationInput,
  ): Prisma.AdvertisementOrderByWithRelationInput {
    return sortBy ? { [sortBy]: order ?? 'asc' } : fallback;
  }

  // Offres PENDING d'une annonce, réservées à l'auteur (ACL dans le contrôleur).
  // Forme alignée sur l'ancien champ `offers` embarqué dans l'annonce, pour
  // rester un drop-in côté front : { ...offer, createdAt, author }.
  async findOffers(advertisementId: string) {
    const offers = await this.databaseService.messageOffer.findMany({
      where: {
        status: 'PENDING',
        message: { conversation: { advertisementId } },
      },
      include: {
        message: {
          select: {
            createdAt: true,
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return offers.map(({ message, ...offer }) => ({
      ...offer,
      createdAt: message.createdAt,
      author: plainToInstance(PublicUserEntity, message.author, {
        excludeExtraneousValues: true,
      }),
    }));
  }

  async create(dto: CreateAdvertisementDto & { packageIds?: string[] }) {
    const { destinationId, departureId, authorId, packageIds, ...data } = dto;

    // Les colis rattachés doivent appartenir à l'auteur de l'annonce
    if (packageIds?.length) {
      const owned = await this.databaseService.package.count({
        where: { id: { in: packageIds }, ownerId: authorId },
      });
      if (owned !== packageIds.length) {
        throw new BadRequestException(
          'Some packages do not belong to the advertisement author',
        );
      }
    }

    // Annonce SHIPPING : la mission-dossier (sans carrier, status PENDING)
    // est créée atomiquement avec l'annonce et porte les colis. C'est elle
    // qui sera connectée aux conversations puis activée à l'acceptation.
    const missionDossier =
      data.type === 'SHIPPING'
        ? {
            missions: {
              create: {
                shipper: { connect: { id: authorId } },
                ...(packageIds?.length
                  ? {
                      packages: {
                        createMany: {
                          data: packageIds.map((packageId) => ({ packageId })),
                        },
                      },
                    }
                  : {}),
              },
            },
          }
        : {};

    return this.advertisements.create({
      data: {
        ...data,
        arrivalDate: new Date(data.arrivalDate),
        departureDate: data.departureDate
          ? new Date(data.departureDate)
          : undefined,
        author: { connect: { id: authorId } },
        departure: { connect: { id: departureId } },
        destination: { connect: { id: destinationId } },
        ...missionDossier,
      },
    });
  }

  async update({ data, where }: Update) {
    try {
      return await this.advertisements.update({ where, data });
    } catch (e) {
      if (e?.code === 'P2025')
        throw new NotFoundException('Advertisement not found');
      throw e;
    }
  }

  async updateById(id: string, data: Prisma.AdvertisementUpdateInput) {
    return this.advertisements.update({ where: { id }, data });
  }

  async setStatus(id: string, status: AdvertisementStatus) {
    return this.advertisements.update({ where: { id }, data: { status } });
  }

  async delete(where: Delete) {
    try {
      await this.advertisements.delete(where);
    } catch (e) {
      if (e?.code === 'P2025')
        throw new NotFoundException('Advertisement not found');
      throw e;
    }
  }
}
