import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Prisma } from '@prisma/client';
import { DecimalJsLike } from '@prisma/client/runtime/library';
import {
  IsEmpty,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePackageDto implements Prisma.PackageUncheckedCreateInput {
  // Aligné sur le contrat client (zod) : 2–80 caractères
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  // Aligné sur le contrat client (zod) : ≤ 500 caractères
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description: string;

  // Aligné sur le contrat client (zod) : nombre > 0, max 1000 kg
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  @Max(1000)
  weight: string | number | Prisma.Decimal | DecimalJsLike;

  @IsEmpty()
  ownerId: string;
}

export class UpdatePackageDto extends PartialType(
  OmitType(CreatePackageDto, ['ownerId']),
) {}
