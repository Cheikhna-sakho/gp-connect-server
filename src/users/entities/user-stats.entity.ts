import { Expose, Type } from 'class-transformer';

export class UserStatsEntity {
  @Expose() missionsCompleted: number;
  @Expose() missionsAsCarrier: number;
  @Expose() missionsAsShipper: number;
  @Expose() packagesDelivered: number;

  @Type(() => Number)
  @Expose()
  totalEarned: number;

  @Expose() averageRating: number | null;
  @Expose() ratingsCount: number;

  constructor(partial: Partial<UserStatsEntity>) {
    Object.assign(this, partial);
  }
}
