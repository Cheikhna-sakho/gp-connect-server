import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdvertisementStatus, Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateAdvertisementDto } from './dtos/create-advertisements.dto';
import {
  ADVERTISEMENT_CONVERSATION_INCLUDE,
  ADVERTISEMENT_DEFAULT_INCLUDE,
} from './entities/advertisement.entity';

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

  async findOffers(advertisementId: string) {
    return this.databaseService.messageOffer.findMany({
      where: {
        status: 'PENDING',
        message: { conversation: { advertisementId } },
      },
      include: {
        message: {
          select: {
            createdAt: true,
            authorId: true,
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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
