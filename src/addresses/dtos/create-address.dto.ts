import { Prisma } from '@prisma/client';
import { IsString, IsNotEmpty, IsOptional, IsLatitude } from 'class-validator';

export class CreateAddressDto implements Prisma.AddressUncheckedCreateInput {
  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsNotEmpty()
  cityId: string;

  @IsString()
  @IsOptional()
  zipCode: string;

  @IsLatitude()
  @IsOptional()
  latitude: number;

  @IsLatitude()
  @IsOptional()
  longitude: number;
}
