import {
  $Enums,
  MissionProof,
  Prisma,
  Transaction,
  User,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Transform, Type } from 'class-transformer';
import { MissionPackageEntity } from './mission-package.entity';
import { UserEntity } from 'src/users/entities/user.entity';

// Used for list endpoints — lightweight (no proof images, no transaction)
export const MISSION_DEFAULT_INCLUDE = {
  packages: { select: { package: true } },
} as const;

// Used for detail endpoint — full data
export const MISSION_DETAIL_INCLUDE = {
  packages: { select: { package: true } },
  transaction: true,
  proofs: {
    include: {
      images: {
        include: { image: true },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
} as const;
type Mission = Prisma.MissionGetPayload<{
  include: typeof MISSION_DETAIL_INCLUDE;
}>;

export class MissionEntity implements Mission {
  @Expose() id: string;

  @Expose() advertisementId: string;

  @Expose()
  @Type(() => Number)
  negotiatedPrice: Decimal;

  @Expose() status: $Enums.MissionStatus;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => MissionPackageEntity)
  packages: MissionPackageEntity[];

  @Expose()
  get cumulatedWeight() {
    return this.packages
      ?.map(({ package: p }) => p.weight)
      .reduce((total, weight) => {
        total += Number(weight);
        return total;
      }, 0);
  }

  @Expose()
  get packagesCount() {
    return this.packages?.length ?? 0;
  }

  @Expose() shipperId: string;
  @Type(() => UserEntity)
  @Expose()
  shipper: User;

  @Expose() carrierId: string;
  @Type(() => UserEntity)
  @Expose()
  carrier: User;

  // proofs avec leurs images — transformé en { type → url[] } pour le frontend
  @Expose()
  @Transform(
    ({
      value,
    }: {
      value?: (MissionProof & { images: { image: { url: string } }[] })[];
    }) => {
      if (!value) return undefined;
      return value.reduce<Record<string, string[]>>((acc, proof) => {
        acc[proof.type] = proof.images.map((pi) => pi.image.url);
        return acc;
      }, {});
    },
  )
  proofs: any[];

  // Transaction — only present on detail view
  @Expose()
  transaction: Transaction | null;

  constructor(partial: Partial<MissionEntity>) {
    Object.assign(this, partial);
  }
}
