import { Package } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Type } from 'class-transformer';

export class PackageEntity implements Package {
  id: string;
  name: string;
  description: string;
  weight: Decimal;
  ownerId: string;
  @Type(() => Date)
  createdAt: Date;
  @Type(() => Date)
  updatedAt: Date;

  constructor(partial: Partial<PackageEntity>) {
    Object.assign(this, partial);
  }
}
