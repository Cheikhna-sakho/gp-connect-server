import { $Enums } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @IsEnum($Enums.ReportTargetType)
  targetType: $Enums.ReportTargetType;

  @IsUUID()
  targetId: string;

  @IsEnum($Enums.ReportReason)
  reason: $Enums.ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
