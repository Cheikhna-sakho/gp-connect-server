import { $Enums, Message, MessageOffer, Prisma } from '@prisma/client';
import { Expose, Transform, Type } from 'class-transformer';
import { MessageOfferEntity } from './message-offer.entity';

type MessageMedia = Prisma.MessageMediaGetPayload<{ include: { media: true } }>;

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

  // Transforme medias[] → tableau d'URLs pour les messages MEDIA
  @Expose()
  @Transform(
    ({ value }: { value?: MessageMedia[] }) =>
      value?.map((m) => m.media.url) ?? [],
  )
  medias: MessageMedia[];

  constructor(partial: Partial<MessageEntity>) {
    Object.assign(this, partial);
  }
}
