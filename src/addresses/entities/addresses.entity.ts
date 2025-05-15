import { Address } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';
import { CityEntity } from './city.entity';

export class AddressEntity implements Address {
  @Expose() id: string;

  @Expose() street: string;

  @Expose() zipCode: string;

  @Expose() cityId: string;

  @Type(() => CityEntity)
  @Expose()
  city: CityEntity;

  @Type(() => Number)
  @Expose()
  latitude: Decimal;

  @Type(() => Number)
  @Expose()
  longitude: Decimal;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<AddressEntity>) {
    Object.assign(this, partial);
  }
}
