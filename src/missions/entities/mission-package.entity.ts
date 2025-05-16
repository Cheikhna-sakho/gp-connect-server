import { Package, Prisma } from '@prisma/client';
import { Expose, plainToInstance, Type } from 'class-transformer';
import { PackageEntity } from 'src/packages/entities/package.entity';

type MissionPackage = Prisma.MissionPackageGetPayload<{
  select: { package: true };
}>;
// type A = MissionPackage & Package;
export class MissionPackageEntity
  extends PackageEntity
  implements MissionPackage
{
  @Type(() => PackageEntity)
  @Expose({ toClassOnly: true })
  package: Package;

  constructor(partial: Partial<MissionPackageEntity>) {
    const a = { ...partial };
    super(plainToInstance(PackageEntity, a['package']));
    Object.assign(this, a);
  }
}
