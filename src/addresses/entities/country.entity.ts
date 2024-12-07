import { Country } from '@prisma/client';
import { Expose } from 'class-transformer';

export class CountryEntity implements Country {
  @Expose() id: string;

  @Expose() name: string;

  @Expose() isoCode: string;

  constructor(partial: Partial<Country>) {
    Object.assign(this, partial);
  }
}
