import { $Enums, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Transform } from 'class-transformer';
import {
  IsDate,
  IsEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class AdvertisementDto
  implements Prisma.AdvertisementUncheckedCreateInput
{
  @IsEnum($Enums.AdvertisementType)
  @IsOptional()
  type?: $Enums.AdvertisementType;

  @IsNumber()
  price: Decimal;

  @IsNumber()
  maxWeight: Decimal;

  @IsUUID()
  destinationId: string;

  @IsUUID()
  departureId: string;

  @IsEmpty()
  authorId: string;

  @IsDate()
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  departureDate?: Date;

  @IsDate()
  @Transform(({ value }) => new Date(value))
  arrivalDate: Date;
}
