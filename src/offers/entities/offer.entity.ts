import { $Enums, MessageOffer } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose } from 'class-transformer';

export class OfferEntity implements MessageOffer {
  @Expose() id: string;

  @Expose() price: Decimal;

  @Expose() weight: Decimal;

  @Expose() missionId: string;

  @Expose() status: $Enums.MessageOfferStatus;

  @Expose() createdAt: Date;

  @Expose() updatedAt: Date;

  constructor(partial: Partial<MessageOffer>) {
    Object.assign(this, partial);
  }
}
