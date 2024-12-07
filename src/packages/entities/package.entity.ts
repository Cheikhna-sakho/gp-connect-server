import { Package } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';

export class PackageEntity implements Package {
  @Expose() id: string;

  @Expose() name: string;

  @Expose() description: string;

  @Type(() => Number)
  @Expose()
  weight: Decimal;

  @Expose() ownerId: string;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<PackageEntity>) {
    Object.assign(this, partial);
  }
}
