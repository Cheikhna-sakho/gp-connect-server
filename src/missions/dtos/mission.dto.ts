import { $Enums, Mission } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  IsArray,
  IsDate,
  IsEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class MissionDto implements Mission {
  @IsEmpty()
  id: string;
  @IsUUID()
  advertisementId: string;
  @IsEmpty()
  shipperId: string;
  @IsUUID()
  carrierId: string;
  @IsNumber()
  negotiatedPrice: Decimal;
  @IsEnum($Enums.MissionStatus)
  status: $Enums.MissionStatus;
  @IsDate()
  createdAt: Date;
  @IsDate()
  updatedAt: Date;

  @IsArray()
  @IsOptional()
  @IsUUID(null, { each: true })
  packageIds?: string[];
}
