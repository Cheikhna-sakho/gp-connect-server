import { $Enums, Mission } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';

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

  constructor(partial: Partial<MissionEntity>) {
    Object.assign(this, partial);
  }
}
