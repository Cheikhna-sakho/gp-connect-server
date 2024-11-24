import { Address } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Type } from 'class-transformer';

export class AddressEntity implements Address {
  id: string;
  street: string;
  zipCode: string;
  cityId: string;
  latitude: Decimal;
  longitude: Decimal;
  @Type(() => Date)
  createdAt: Date;
  @Type(() => Date)
  updatedAt: Date;

  constructor(partial: Partial<AddressEntity>) {
    Object.assign(this, partial);
  }
}
