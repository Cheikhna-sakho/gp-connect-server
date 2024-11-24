import { $Enums, Mission } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Type } from 'class-transformer';

export class MissionEntity implements Mission {
  id: string;
  advertisementId: string;
  packageId: string;
  initiatorId: string;
  acceptorId: string;
  negotiatedPrice: Decimal;
  status: $Enums.MissionStatus;
  @Type(() => Date)
  createdAt: Date;
  @Type(() => Date)
  updatedAt: Date;
  constructor(partial: Partial<MissionEntity>) {
    Object.assign(this, partial);
  }
}
