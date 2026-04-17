import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateMessageDto } from './dtos/message.dto';
import { MediasService } from 'src/medias/medias.service';
import { UpdateOfferDto } from './dtos/message-offer-update.dto';

export const MESSAGE_INCLUDE = { offer: true } as const;
// export const MESSAGE_INCLUDE = {
//   offer: { include: { mission: true } },
// } as const;

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

  find(where: Prisma.MessageWhereInput) {
    return this.messages.findMany({ where });
  }

  async create({ offer, ...data }: Omit<CreateMessageDto, 'advertisementId'>) {
    console.log({ data });
    return this.messages.create({
      data: {
        ...data,
        ...(data.type === 'OFFER' ? { offer: { create: offer } } : {}),
      },
      include: { offer: true },
    });
  }
  createOffer(data: Prisma.MessageOfferUncheckedCreateInput) {
    return this.offers.create({ data });
  }
  updateOffer(id: string, data: UpdateOfferDto) {
    return this.offers.update({ where: { id }, data });
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
