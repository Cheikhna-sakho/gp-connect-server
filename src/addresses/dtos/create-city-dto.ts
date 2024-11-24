import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCityDto implements Prisma.CityUncheckedCreateInput {
  @IsString()
  @IsNotEmpty()
  name: string;
  @IsString()
  countryId: string;
  @IsString()
  @IsOptional()
  stateId?: string;
}
