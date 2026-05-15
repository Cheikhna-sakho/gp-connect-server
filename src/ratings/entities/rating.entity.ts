import { MissionRating } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

export class RatingEntity implements MissionRating {
  @Expose() id: string;
  @Expose() missionId: string;
  @Expose() raterId: string;
  @Expose() ratedId: string;
  @Expose() score: number;
  @Expose() comment: string;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  constructor(partial: Partial<MissionRating>) {
    Object.assign(this, partial);
  }
}
