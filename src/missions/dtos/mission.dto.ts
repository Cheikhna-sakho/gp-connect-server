import { $Enums, Mission } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { IsDate, IsEmpty, IsEnum, IsNumber, IsUUID } from 'class-validator';

export class MissionDto implements Mission {
  @IsEmpty()
  id: string;
  @IsUUID()
  advertisementId: string;
  @IsEmpty()
  initiatorId: string;
  @IsUUID()
  acceptorId: string;
  @IsNumber()
  negotiatedPrice: Decimal;
  @IsEnum($Enums.MissionStatus)
  status: $Enums.MissionStatus;
  @IsDate()
  createdAt: Date;
  @IsDate()
  updatedAt: Date;
}
