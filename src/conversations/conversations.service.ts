import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { AdvertisementsService } from 'src/advertisements/advertisements.service';
import { DatabaseService } from 'src/database/database.service';
import { MESSAGE_INCLUDE } from 'src/messages/messages.service';
import { USER_DEFAULT_INCLUDE } from 'src/users/entities/user.entity';
import { CreateConversationDto } from './dtos/create-conversation.dto';
@Injectable()
export class ConversationsService {
  private conversations: DatabaseService['conversation'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly advertisementsService: AdvertisementsService,
  ) {
    this.conversations = this.databaseService.conversation;
  }

  findOne(id: string, userId: string) {
    return this.conversations.findUnique({
      where: {
        id,
        OR: [{ shipperId: userId }, { carrierId: userId }],
      },
      include: {
        messages: { include: MESSAGE_INCLUDE },
        shipper: { include: USER_DEFAULT_INCLUDE },
        carrier: { include: USER_DEFAULT_INCLUDE },
      },
    });
  }

  async findAll(userId: string) {
    const convs = await this.conversations.findMany({
      where: { OR: [{ shipperId: userId }, { carrierId: userId }] },
      include: {
        shipper: true,
        carrier: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return convs.sort((a, b) => {
      const aDate = a.messages[0]?.createdAt?.getTime() ?? 0;
      const bDate = b.messages[0]?.createdAt?.getTime() ?? 0;
      return bDate - aDate;
    });
  }

  findByAdvertisement(advertisementId: string, userId: string) {
    return this.conversations.findFirst({
      where: {
        advertisementId,
        OR: [{ shipperId: userId }, { carrierId: userId }],
      },
    });
  }
  create({ packageIds, ...data }: CreateConversationDto) {
    return this.conversations.create({
      data: {
        advertisement: { connect: { id: data.advertisementId } },
        mission: {
          connectOrCreate: {
            where: { id: data?.missionId ?? '' },
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
              // packages: { connect: { packageId: { in: [] } } },
            },
          },
        },
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
