import { $Enums, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class AdvertisementDto
  implements Prisma.AdvertisementUncheckedCreateInput
{
  @IsEnum($Enums.AdvertisementType)
  type?: $Enums.AdvertisementType;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
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
  @Type(() => Date)
  // @Transform(({ value }) => new Date(value))
  departureDate?: Date;

  @IsDate()
  @Type(() => Date)
  // @Transform(({ value }) => new Date(value))
  arrivalDate: Date;
}
