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

  // Transforme medias[] → tableau d'URLs pour les messages MEDIA.
  // toPlainOnly obligatoire : sans lui, la double sérialisation (route
  // @Serialize + ClassSerializerInterceptor global) rejoue ce transform sur
  // son propre résultat (des strings) → crash `undefined.url`. Même piège
  // que `proofs` dans MissionEntity.
  @Expose()
  @Transform(
    ({ value }: { value?: (MessageMedia | string)[] }) =>
      value
        ?.map((m) => (typeof m === 'string' ? m : m.media?.url))
        .filter(Boolean) ?? [],
    { toPlainOnly: true },
  )
  medias: MessageMedia[];

  constructor(partial: Partial<MessageEntity>) {
    Object.assign(this, partial);
  }
}
