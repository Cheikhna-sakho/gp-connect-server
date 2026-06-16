import { $Enums, Prisma } from '@prisma/client';
import {
  IsOptional,
  IsUUID,
  IsEmpty,
  IsEnum,
  IsNumber,
  Min,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOfferDto implements Prisma.MessageOfferUncheckedCreateInput {
  @IsEmpty()
  id: string;

  // Prix proposé → alimente negotiatedPrice + transaction.amount à l'acceptation
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  weight: number;

  @IsUUID()
  @IsOptional()
  missionId: string;

  @IsEmpty()
  messageId: string;

  @IsEnum($Enums.MessageOfferStatus)
  @IsOptional()
  status?: $Enums.MessageOfferStatus;
}
