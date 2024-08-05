import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class MessagesService {
  private messages: DatabaseService['message'];

  constructor(private readonly databaseService: DatabaseService) {
    this.messages = this.databaseService.message;
  }
  findBy(where: Prisma.MessageWhereUniqueInput) {
    return this.messages.findUnique({ where });
  }
  find(where: Prisma.MessageWhereInput) {
    return this.messages.findMany({ where });
  }
  create(data: Prisma.MessageCreateInput) {
    return this.messages.create({ data });
  }
  update({
    where,
    data,
  }: {
    where: Prisma.MessageWhereUniqueInput;
    data: Prisma.MessageUpdateInput;
  }) {
    return this.messages.update({ where, data });
  }
  delete(id: UUID) {
    return this.messages.delete({ where: { id } });
  }
}
