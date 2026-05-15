import { Prisma } from '@prisma/client';
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAddressDto implements Prisma.AddressUncheckedCreateInput {
  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsNotEmpty()
  cityId: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @IsLongitude()
  @IsOptional()
  longitude?: number;
}
