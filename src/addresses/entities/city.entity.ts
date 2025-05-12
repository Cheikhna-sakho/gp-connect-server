import { City } from '@prisma/client';
import { Expose } from 'class-transformer';

export class CityEntity implements City {
  @Expose() id: string;

  @Expose() name: string;

  @Expose()
  country: string;

  @Expose()
  countryIsoCode: string;

  constructor(partial: Partial<City>) {
    Object.assign(this, partial);
  }
}
