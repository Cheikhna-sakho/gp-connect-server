import { $Enums, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Transform, Type } from 'class-transformer';

type PackageMedia = Prisma.PackageMediaGetPayload<{ include: { media: true } }>;

type PackageWithIncludes = Prisma.PackageGetPayload<{
  include: {
    images: { include: { media: true } };
  };
}>;
export class PackageEntity implements PackageWithIncludes {
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
  @Expose()
  @Transform(({ value }: { value?: PackageMedia[] }) => {
    if (typeof value?.[0] === 'string') {
      return value;
    }
    return value?.map(({ media }) => media.url);
  })
  images: PackageMedia[];

  @Expose() status: $Enums.PackageStatus;
  constructor(partial: Partial<PackageWithIncludes>) {
    Object.assign(this, partial);
  }
}
