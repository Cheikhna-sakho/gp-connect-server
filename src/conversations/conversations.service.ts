import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { AdvertisementsService } from 'src/advertisements/advertisements.service';
import { DatabaseService } from 'src/database/database.service';
import { USER_DEFAULT_INCLUDE } from 'src/users/entities/user.entity';
const MESSAGE_INCLUDE = { include: { offer: true } } as const;
@Injectable()
export class ConversationsService {
  private conversations: DatabaseService['conversation'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly advertisementsService: AdvertisementsService,
  ) {
    this.conversations = this.databaseService.conversation;
  }

  findBy(where: Prisma.ConversationWhereUniqueInput) {
    return this.conversations.findUnique({
      where,
      include: {
        messages: MESSAGE_INCLUDE,
        shipper: { include: USER_DEFAULT_INCLUDE },
        carrier: { include: USER_DEFAULT_INCLUDE },
      },
    });
  }

  findAll(where: Prisma.ConversationWhereInput) {
    return this.conversations.findMany({
      where,
      include: {
        shipper: true,
        carrier: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }
  findOne(where: Prisma.ConversationWhereInput) {
    return this.conversations.findFirst({
      where,
      include: {
        messages: MESSAGE_INCLUDE,
        advertisement: true,
      },
    });
  }
  create(
    data: Prisma.ConversationCreateInput,
    include?: Prisma.ConversationInclude,
  ) {
    return this.conversations.create({ data, include });
  }
  async createIfNotExist({
    advertisementId,
    initiatorId,
  }: {
    initiatorId: string;
    advertisementId: string;
  }) {
    const { type, authorId: userId } = await this.advertisementsService.findBy({
      id: advertisementId,
    });
    const userRoleInConversation =
      type === 'DeliveryOffer'
        ? { carrierId: userId, shipperId: initiatorId }
        : { carrierId: initiatorId, shipperId: userId };
    const existing = await this.conversations.findFirst({
      where: { advertisementId, ...userRoleInConversation },
      select: { id: true },
    });
    if (existing) return existing;
    return this.conversations.create({
      data: { advertisementId, ...userRoleInConversation },
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
