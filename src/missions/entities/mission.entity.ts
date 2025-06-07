import { $Enums, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';
import { MissionPackageEntity } from './mission-package.entity';

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

  @Expose() initiatorId: string;

  @Expose() acceptorId: string;

  @Expose() negotiatedPrice: Decimal;

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
  constructor(partial: Partial<MissionEntity>) {
    Object.assign(this, partial);
  }
}
