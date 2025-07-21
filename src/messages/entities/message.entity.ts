import { $Enums, Message, MessageOffer } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import { MessageOfferEntity } from './message-offer.entity';

export class MessageEntity implements Message {
  @Expose() id: string;

  @Expose() content: string;

  @Expose() conversationId: string;

  @Expose() authorId: string;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  mediaId: string;

  @Expose()
  type: $Enums.MessageType;

  @Expose()
  @Type(() => MessageOfferEntity)
  offer: MessageOffer;

  constructor(partial: Partial<MessageEntity>) {
    Object.assign(this, partial);
  }
}
