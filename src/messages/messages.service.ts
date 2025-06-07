import { Injectable } from '@nestjs/common';
import { MessageOffer, Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateMessageDto } from './dtos/message.dto';
import { MediasService } from 'src/medias/medias.service';

@Injectable()
export class MessagesService {
  private messages: DatabaseService['message'];
  private offers: DatabaseService['messageOffer'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mediasService: MediasService,
  ) {
    this.messages = this.databaseService.message;
    this.offers = this.databaseService.messageOffer;
  }
  findBy(where: Prisma.MessageWhereUniqueInput) {
    return this.messages.findUnique({ where });
  }
  find(where: Prisma.MessageWhereInput) {
    return this.messages.findMany({ where });
  }

  async create({ offer, ...data }: Omit<CreateMessageDto, 'advertisementId'>) {
    let newOffer = {} as MessageOffer;
    const message = await this.messages.create({ data });
    if (data.type === 'OFFER') {
      console.log({ data });
      newOffer = await this.createOffer({
        ...offer,
        messageId: message.id,
      });
    }
    return { ...message, offers: [newOffer] };
  }
  createOffer(data: Prisma.MessageOfferUncheckedCreateInput) {
    return this.offers.create({ data });
  }
  async createAudio(audio: Express.Multer.File) {
    return this.mediasService.createAudio(audio);
  }
  async handleNewConversation() {}
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
