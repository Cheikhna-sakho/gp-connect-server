import { $Enums, Advertisement } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Type } from 'class-transformer';

export class AdvertisementEntity implements Advertisement {
  id: string;
  type: $Enums.AdvertisementType;
  price: Decimal;
  maxWeight: Decimal;
  destinationId: string;
  departureId: string;
  authorId: string;
  @Type(() => Date)
  departureDate: Date;
  @Type(() => Date)
  arrivalDate: Date;
  @Type(() => Date)
  createdAt: Date;
  @Type(() => Date)
  updatedAt: Date;
  constructor(partial: Partial<AdvertisementEntity>) {
    Object.assign(this, partial);
  }
}
