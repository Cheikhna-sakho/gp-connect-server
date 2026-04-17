import { $Enums, Prisma, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';
import { MissionPackageEntity } from './mission-package.entity';
import { UserEntity } from 'src/users/entities/user.entity';

export const MISSION_DEFAULT_INCLUDE = {
  packages: { select: { package: true } },
} as const;
type Mission = Prisma.MissionGetPayload<{
  include: typeof MISSION_DEFAULT_INCLUDE;
}>;

export class MissionEntity implements Mission {
  @Expose() id: string;

  @Expose() advertisementId: string;

  @Expose() packageId: string;

  // @Expose() initiatorId: string;

  // @Expose() acceptorId: string;

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
    return this.packages.length;
  }

  @Expose() shipperId: string;
  @Type(() => UserEntity)
  @Expose()
  shipper: User;

  @Expose() carrierId: string;
  @Type(() => UserEntity)
  @Expose()
  carrier: User;

  constructor(partial: Partial<MissionEntity>) {
    console.log({ partial });
    Object.assign(this, partial);
  }
}
