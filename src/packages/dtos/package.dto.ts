import { Prisma } from '@prisma/client';
import { DecimalJsLike } from '@prisma/client/runtime/library';
import {
  IsEmpty,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePackageDto implements Prisma.PackageUncheckedCreateInput {
  @IsNotEmpty()
  @IsString()
  name: string;
  @IsOptional()
  @IsString()
  description: string;
  @IsNotEmpty()
  @IsNumberString()
  weight: string | number | Prisma.Decimal | DecimalJsLike;
  @IsEmpty()
  ownerId: string;
}

export class CreatePackageImagesDto {
  @IsNotEmpty()
  packageId: string;
  @IsNotEmpty()
  images: File[];
}
