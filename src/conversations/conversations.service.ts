import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { MESSAGE_INCLUDE } from 'src/messages/messages.service';
import { USER_DEFAULT_INCLUDE } from 'src/users/entities/user.entity';
import { CreateConversationDto } from './dtos/create-conversation.dto';
import { BlocksService } from 'src/blocks/blocks.service';

// Une conversation liée à une mission en cours ne peut PAS être hard-deletée :
// le cascade effacerait l'historique (messages/offres/médias), preuve d'un
// engagement en cours ou en litige.
const ACTIVE_MISSION_STATUSES: $Enums.MissionStatus[] = [
  'ACCEPTED',
  'IN_TRANSIT',
  'DISPUTED',
];

@Injectable()
export class ConversationsService {
  private conversations: DatabaseService['conversation'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly blocksService: BlocksService,
  ) {
    this.conversations = this.databaseService.conversation;
  }

  // Blocage : on refuse l'interaction si l'un a bloqué l'autre. Utilisé à la
  // création d'une conversation ET à l'envoi d'un message (cf. messages).
  async assertNotBlocked(conversationId: string, userId: string) {
    const conv = await this.conversations.findUnique({
      where: { id: conversationId },
      select: { shipperId: true, carrierId: true },
    });
    if (!conv) return;
    const other = conv.shipperId === userId ? conv.carrierId : conv.shipperId;
    if (await this.blocksService.isBlockedBetween(userId, other)) {
      throw new ForbiddenException(
        'Interaction indisponible avec cet utilisateur',
      );
    }
  }

  // Filtre de la LISTE : on masque une conversation à un participant qui l'a
  // soft-deletée de son côté. L'accès direct (findOne) reste possible — rouvrir
  // une conversation « supprimée » la réaffiche (et un nouveau message la fait
  // réapparaître dans la liste, cf. MessagesService).
  private visibleFor(userId: string): Prisma.ConversationWhereInput {
    return {
      OR: [
        { shipperId: userId, shipperDeletedAt: null },
        { carrierId: userId, carrierDeletedAt: null },
      ],
    };
  }

  findOne(id: string, userId: string) {
    return this.conversations.findFirst({
      where: {
        id,
        OR: [{ shipperId: userId }, { carrierId: userId }],
      },
      include: {
        messages: {
          include: MESSAGE_INCLUDE,
          orderBy: { createdAt: 'asc' },
        },
        shipper: { include: USER_DEFAULT_INCLUDE },
        carrier: { include: USER_DEFAULT_INCLUDE },
      },
    });
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;
    const baseWhere = this.visibleFor(userId);

    const [data, total] = await Promise.all([
      this.conversations.findMany({
        where: baseWhere,
        include: {
          shipper: true,
          carrier: true,
          messages: {
            include: { offer: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [
          { lastMessageAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        skip,
        take: safeLimit,
      }),
      this.conversations.count({ where: baseWhere }),
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

  async getAdvertisementForConversation(
    conversationId: string,
    userId: string,
  ) {
    const conv = await this.conversations.findFirst({
      where: {
        id: conversationId,
        OR: [{ shipperId: userId }, { carrierId: userId }],
      },
      select: {
        advertisement: {
          select: {
            arrivalDate: true,
            status: true,
            maxWeight: true,
            type: true,
          },
        },
      },
    });
    return conv?.advertisement ?? null;
  }

  /**
   * Garde métier d'une OFFRE : l'annonce doit exister pour ce participant, ne
   * pas être expirée, être encore disponible, et le poids proposé ne doit pas
   * dépasser le max de l'annonce. Centralisé ici pour rester l'unique source
   * de vérité quel que soit le point d'entrée (REST aujourd'hui).
   */
  async assertOfferAllowed(
    conversationId: string,
    userId: string,
    weight?: number | null,
  ) {
    const ad = await this.getAdvertisementForConversation(
      conversationId,
      userId,
    );
    if (!ad) throw new ForbiddenException();
    if (ad.arrivalDate < new Date()) {
      throw new BadRequestException('This advertisement has expired');
    }
    if (ad.status !== 'OPEN' && ad.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'This advertisement is no longer available',
      );
    }
    if (
      weight != null &&
      ad.maxWeight != null &&
      weight > Number(ad.maxWeight)
    ) {
      throw new BadRequestException(
        'Offer weight exceeds the advertisement maximum',
      );
    }
  }

  async isParticipant(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.conversations.count({
      where: {
        id: conversationId,
        OR: [{ shipperId: userId }, { carrierId: userId }],
      },
    });
    return count > 0;
  }

  findByAdvertisement(advertisementId: string, userId: string) {
    return this.conversations.findFirst({
      where: {
        advertisementId,
        OR: [{ shipperId: userId }, { carrierId: userId }],
      },
    });
  }

  /**
   * Suppression par un participant :
   *  - une seule partie a supprimé → soft delete (masqué pour elle seule) ;
   *  - les deux ont supprimé → hard delete (cascade) si aucune mission active,
   *    sinon on conserve en statut DELETED (preuve d'un engagement en cours).
   * Une conversation soft-deletée redevient visible dès qu'un nouveau message
   * arrive (cf. MessagesService).
   */
  async removeForUser(id: string, userId: string): Promise<void> {
    const conv = await this.conversations.findFirst({
      where: { id, OR: [{ shipperId: userId }, { carrierId: userId }] },
      select: {
        id: true,
        shipperId: true,
        carrierId: true,
        shipperDeletedAt: true,
        carrierDeletedAt: true,
        mission: { select: { status: true } },
      },
    });
    if (!conv) throw new ForbiddenException();

    const isShipper = conv.shipperId === userId;
    const otherDeletedAt = isShipper
      ? conv.carrierDeletedAt
      : conv.shipperDeletedAt;
    const sideDeletedAt = isShipper
      ? { shipperDeletedAt: new Date() }
      : { carrierDeletedAt: new Date() };

    // Les deux parties ont supprimé.
    if (otherDeletedAt) {
      const missionActive =
        !!conv.mission && ACTIVE_MISSION_STATUSES.includes(conv.mission.status);
      if (!missionActive) {
        await this.conversations.delete({ where: { id } });
        return;
      }
      await this.conversations.update({
        where: { id },
        data: { status: 'DELETED', ...sideDeletedAt },
      });
      return;
    }

    // Soft delete : masqué pour ce participant uniquement.
    await this.conversations.update({ where: { id }, data: sideDeletedAt });
  }

  /**
   * Mission-dossier d'une annonce SHIPPING : la mission PENDING sans carrier
   * créée atomiquement avec l'annonce, qui porte les colis du shipper.
   */
  findDossierMission(advertisementId: string, shipperId: string) {
    return this.databaseService.mission.findFirst({
      where: {
        advertisementId,
        shipperId,
        carrierId: null,
        status: 'PENDING',
      },
      select: { id: true },
    });
  }

  async create({ packageIds, ...data }: CreateConversationDto) {
    // Blocage : on n'initie pas de contact si l'un a bloqué l'autre.
    if (
      await this.blocksService.isBlockedBetween(data.shipperId, data.carrierId)
    ) {
      throw new ForbiddenException(
        'Interaction indisponible avec cet utilisateur',
      );
    }

    await this.assertPackagesOwnedBy(packageIds, data.shipperId);

    try {
      return await this.conversations.create({
        data: {
          advertisement: { connect: { id: data.advertisementId } },
          mission: this.buildMissionRelation(data, packageIds),
          shipper: { connect: { id: data.shipperId } },
          carrier: { connect: { id: data.carrierId } },
        },
      });
    } catch (e) {
      // Conflit d'unicité (advertisement, shipper, carrier) : une conversation
      // existe déjà pour ce trio (double POST / race). On renvoie l'existante
      // au lieu d'un 500, l'opération est idempotente.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const existing = await this.findExistingForTrio(data);
        if (existing) return existing;
      }
      throw e;
    }
  }

  /**
   * On ne rattache que des colis appartenant au shipper de la mission :
   * sinon on pourrait lier les colis d'autrui à sa propre mission.
   */
  private async assertPackagesOwnedBy(
    packageIds: string[] | undefined,
    shipperId: string,
  ) {
    if (!packageIds?.length) return;
    const owned = await this.databaseService.package.count({
      where: { id: { in: packageIds }, ownerId: shipperId },
    });
    if (owned !== packageIds.length) {
      throw new ForbiddenException(
        'Some packages do not belong to the shipper',
      );
    }
  }

  /** Mission existante → connect ; sinon mission-dossier créée avec les colis. */
  private buildMissionRelation(
    data: Omit<CreateConversationDto, 'packageIds'>,
    packageIds: string[] | undefined,
  ) {
    return data.missionId
      ? { connect: { id: data.missionId } }
      : {
          create: {
            advertisementId: data.advertisementId,
            shipperId: data.shipperId,
            ...(packageIds?.length
              ? {
                  packages: {
                    createMany: {
                      data: packageIds.map((id) => ({ packageId: id })),
                    },
                  },
                }
              : {}),
          },
        };
  }

  private findExistingForTrio(
    data: Pick<
      CreateConversationDto,
      'advertisementId' | 'shipperId' | 'carrierId'
    >,
  ) {
    return this.conversations.findUnique({
      where: {
        advertisementId_shipperId_carrierId: {
          advertisementId: data.advertisementId,
          shipperId: data.shipperId,
          carrierId: data.carrierId,
        },
      },
    });
  }

  update({
    where,
    data,
  }: {
    where: Prisma.ConversationWhereUniqueInput;
    data: Prisma.ConversationUpdateInput;
  }) {
    return this.conversations.update({ where, data });
  }

  delete(id: UUID) {
    return this.conversations.delete({ where: { id } });
  }
}
