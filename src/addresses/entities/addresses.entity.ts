import { Address } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Exclude, Expose, Type } from 'class-transformer';
import { CityEntity } from './city.entity';

export class AddressEntity implements Address {
  @Exclude() _city: CityEntity | string;
  @Expose() id: string;

  @Expose() street: string;

  @Expose() zipCode: string;

  @Expose() cityId: string;

  @Type(() => CityEntity)
  @Expose()
  get city() {
    return this._city;
  }
  set city(c) {
    if (typeof c === 'object') {
      this.country = c.country.name;
      this._city = c.name;
    } else {
      this._city = c;
    }
  }

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

  @Expose()
  country: string;

  constructor(partial: Partial<AddressEntity>) {
    Object.assign(this, partial);
  }
}
