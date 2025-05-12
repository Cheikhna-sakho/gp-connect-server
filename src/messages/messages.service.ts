import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateMessageDto } from './dtos/message.dto';
import { MediasService } from 'src/medias/medias.service';

@Injectable()
export class MessagesService {
  private messages: DatabaseService['message'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mediasService: MediasService,
  ) {
    this.messages = this.databaseService.message;
  }
  findBy(where: Prisma.MessageWhereUniqueInput) {
    return this.messages.findUnique({ where });
  }
  find(where: Prisma.MessageWhereInput) {
    return this.messages.findMany({ where });
  }

  create(data: Omit<CreateMessageDto, 'advertisementId'>) {
    return this.messages.create({
      data: {
        content: data.content,
        conversation: { connect: { id: data.conversationId } },
        author: { connect: { id: data.authorId } },
      },
    });
  }
  async createAudio(audio: Express.Multer.File) {
    return this.mediasService.createAudio(audio);
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
