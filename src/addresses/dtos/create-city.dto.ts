import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCityDto implements Prisma.CityUncheckedCreateInput {
  @IsString()
  @IsNotEmpty()
  name: string;
  @IsString()
  country: string;
  @IsString()
  countryIsoCode: string;
}
