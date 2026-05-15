import { $Enums } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

export class IdentityStatusEntity {
  @Expose() status: $Enums.UserIdentityStatus;
  @Expose() reason: string;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<IdentityStatusEntity>) {
    Object.assign(this, partial);
  }
}
