import { ApiProperty } from '@nestjs/swagger';
import { $Enums, Mission } from '@prisma/client';
import { ToE164 } from 'src/common/decorators/to-e164.decorator';
import { Decimal } from '@prisma/client/runtime/library';
import {
  IsArray,
  IsDate,
  IsEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
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
  @ApiProperty({ type: Number })
  negotiatedPrice: Decimal;
  @IsEnum($Enums.MissionStatus)
  status: $Enums.MissionStatus;

  // Destinataire à destination (sans compte) — renseigné par le shipper
  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientName: string;

  @IsOptional()
  @ToE164()
  @IsPhoneNumber()
  recipientPhone: string;

  @IsDate()
  createdAt: Date;
  @IsDate()
  updatedAt: Date;

  @IsArray()
  @IsOptional()
  @IsUUID(null, { each: true })
  packageIds?: string[];
}
