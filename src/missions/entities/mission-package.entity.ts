import { Package, Prisma } from '@prisma/client';
import { Expose, plainToInstance, Type } from 'class-transformer';
import { PackageEntity } from 'src/packages/entities/package.entity';
import { MISSION_DEFAULT_INCLUDE } from './mission.entity';

type MissionPackage = Prisma.MissionPackageGetPayload<
  typeof MISSION_DEFAULT_INCLUDE.packages
>;
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
