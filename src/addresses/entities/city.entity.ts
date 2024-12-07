import { City } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import { CountryEntity } from './country.entity';

export class CityEntity implements City {
  @Expose() id: string;

  @Expose() name: string;

  @Expose() stateId: string;

  @Expose() countryId: string;

  @Expose()
  @Type(() => CountryEntity)
  country: CountryEntity;

  constructor(partial: Partial<City>) {
    Object.assign(this, partial);
  }
}
