import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { MESSAGE_INCLUDE } from 'src/messages/messages.service';
import { USER_DEFAULT_INCLUDE } from 'src/users/entities/user.entity';
import { CreateConversationDto } from './dtos/create-conversation.dto';

@Injectable()
export class ConversationsService {
  private conversations: DatabaseService['conversation'];

  constructor(private readonly databaseService: DatabaseService) {
    this.conversations = this.databaseService.conversation;
  }

  findOne(id: string, userId: string) {
    return this.conversations.findUnique({
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
    const baseWhere = { OR: [{ shipperId: userId }, { carrierId: userId }] };

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

  create({ packageIds, ...data }: CreateConversationDto) {
    const missionRelation = data.missionId
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
    return this.conversations.create({
      data: {
        advertisement: { connect: { id: data.advertisementId } },
        mission: missionRelation,
        shipper: { connect: { id: data.shipperId } },
        carrier: { connect: { id: data.carrierId } },
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
