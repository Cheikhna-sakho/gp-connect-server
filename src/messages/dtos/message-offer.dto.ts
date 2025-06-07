import { Prisma } from '@prisma/client';
import { IsOptional, IsUUID, IsEmpty } from 'class-validator';

export class CreateOfferDto implements Prisma.MessageOfferUncheckedCreateInput {
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
}
