import { UserPreferences } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

export class UserPreferencesEntity implements UserPreferences {
  @Expose() userId: string;
  @Expose() notifySms: boolean;
  @Expose() notifyEmail: boolean;
  @Expose() notifyPush: boolean;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<UserPreferences>) {
    Object.assign(this, partial);
  }
}
