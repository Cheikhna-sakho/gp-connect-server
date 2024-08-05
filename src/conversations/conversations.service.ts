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
  findMessages(id: UUID, userId: UUID) {
    return this.conversations.findUnique({
      where: { id, participants: { some: { userId } } },
      include: {
        messages: true,
        participants: { include: { user: true } },
        advertisement: true,
      },
    });
  }
  find(where: Prisma.ConversationWhereInput) {
    return this.conversations.findMany({ where });
  }
  findOne(where: Prisma.ConversationWhereInput) {
    return this.conversations.findFirst({
      where,
      include: {
        messages: true,
        participants: { include: { user: true } },
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
