import { $Enums, MessageOffer } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';

export class MessageOfferEntity implements MessageOffer {
  @Expose() id: string;

  @Type(() => Number)
  @Expose()
  price: Decimal;

  @Type(() => Number)
  @Expose()
  weight: Decimal;

  @Expose() messageId: string;

  @Expose() missionId: string;

  @Expose() status: $Enums.MessageOfferStatus;

  constructor(partial: Partial<MessageOfferEntity>) {
    Object.assign(this, partial);
  }
}
