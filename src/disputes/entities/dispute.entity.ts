import { $Enums, MissionDispute } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

export class DisputeEntity implements MissionDispute {
  @Expose() id: string;
  @Expose() missionId: string;
  @Expose() openedById: string;
  @Expose() reason: string;
  @Expose() description: string;
  @Expose() status: $Enums.DisputeStatus;
  @Expose() resolution: string;
  @Expose() resolvedById: string;

  @Type(() => Date)
  @Expose()
  resolvedAt: Date;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<MissionDispute>) {
    Object.assign(this, partial);
  }
}
