import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ConversationsService {
  private conversations: DatabaseService['conversation'];

  constructor(private readonly databaseService: DatabaseService) {
    this.conversations = this.databaseService.conversation;
  }

  findBy(where: Prisma.ConversationWhereUniqueInput) {
    return this.conversations.findUnique({ where });
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
        messages: true,
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
