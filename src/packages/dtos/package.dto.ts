import { Prisma } from '@prisma/client';
import { DecimalJsLike } from '@prisma/client/runtime/library';
import { IsEmpty, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePackageDto implements Prisma.PackageUncheckedCreateInput {
  @IsNotEmpty()
  name: string;
  @IsOptional()
  description: string;
  @IsNotEmpty()
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
