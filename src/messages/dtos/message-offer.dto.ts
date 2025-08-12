import { $Enums, Prisma } from '@prisma/client';
import { IsOptional, IsUUID, IsEmpty, IsEnum } from 'class-validator';

export class CreateOfferDto implements Prisma.MessageOfferUncheckedCreateInput {
  @IsEmpty()
  id: string;

  //   @IsNumber()
  @IsOptional()
  price: number;

  //   @IsNumber()
  @IsOptional()
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
