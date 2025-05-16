import { $Enums, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';
import { MissionPackageEntity } from './mission-package.entity';

type Mission = Prisma.MissionGetPayload<{
  include: { packages: { select: { package: true } } };
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
  @Type(({}) => MissionPackageEntity)
  packages: MissionPackageEntity[];

  constructor(partial: Partial<MissionEntity>) {
    if (partial?.packages) {
      console.log({ partial });
      // partial.packages.map(({ package: pkg }) => ({
      //   package: plainToInstance(PackageEntity, pkg),
      // }));
    }
    Object.assign(this, partial);
  }
}
