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
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePackageDto implements Prisma.PackageUncheckedCreateInput {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
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
