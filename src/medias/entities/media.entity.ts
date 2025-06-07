import { Media, Prisma } from '@prisma/client';
import { Expose } from 'class-transformer';

export class MediaEntity implements Media {
  @Expose() id: string;
  @Expose() url: string;
  @Expose() type: string;
  @Expose() metadata: Prisma.JsonValue;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
  constructor(partial: Partial<Media>) {
    Object.assign(this, partial);
  }
}
