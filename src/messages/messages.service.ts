import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateMessageDto } from './dtos/message.dto';
import { MediasService } from 'src/medias/medias.service';
import { UpdateOfferDto } from './dtos/message-offer-update.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

export const MESSAGE_INCLUDE = { offer: true } as const;

@Injectable()
export class MessagesService {
  private messages: DatabaseService['message'];
  private offers: DatabaseService['messageOffer'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mediasService: MediasService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.messages = this.databaseService.message;
    this.offers = this.databaseService.messageOffer;
  }

  find(where: Prisma.MessageWhereInput) {
    return this.messages.findMany({
      where,
      include: { ...MESSAGE_INCLUDE, medias: { include: { media: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string) {
    return this.messages.findUnique({ where: { id } });
  }

  async create({ offer, ...data }: Omit<CreateMessageDto, 'advertisementId'>) {
    const message = await this.messages.create({
      data: {
        ...data,
        ...(data.type === 'OFFER' ? { offer: { create: offer } } : {}),
      },
      include: { offer: true },
    });
    await this.databaseService.conversation.update({
      where: { id: data.conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    this.eventEmitter.emit('message.created', {
      message,
      conversationId: data.conversationId,
    });
    return message;
  }

  async createMedia(
    authorId: string,
    conversationId: string,
    file: Express.Multer.File,
  ) {
    const media = await this.mediasService.createByMimetype(file);
    try {
      const message = await this.databaseService.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            content: null,
            authorId,
            conversationId,
            type: 'MEDIA',
            medias: { create: { mediaId: media.id } },
          },
          include: { medias: { include: { media: true } } },
        });
        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: msg.createdAt },
        });
        return msg;
      });
      this.eventEmitter.emit('message.created', { message, conversationId });
      return message;
    } catch (e) {
      await this.mediasService.delete({ id: media.id });
      throw e;
    }
  }

  createOffer(data: Prisma.MessageOfferUncheckedCreateInput) {
    return this.offers.create({ data });
  }

  // Édition des termes de SA propre offre (l'autorisation auteur est faite dans
  // le contrôleur). On n'écrit QUE price/weight, et seulement tant que l'offre
  // est PENDING : le statut/missionId passent par OffersService.
  async updateOffer(id: string, data: UpdateOfferDto) {
    const offer = await this.offers.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!offer) throw new NotFoundException();
    if (offer.status !== 'PENDING') {
      throw new BadRequestException('This offer is no longer pending');
    }
    return this.offers.update({
      where: { id },
      data: { price: data.price, weight: data.weight },
    });
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
