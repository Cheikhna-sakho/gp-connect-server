import { Media, MediaType, Prisma } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

export class MediaEntity implements Media {
  @Expose() id: string;
  @Expose() url: string;
  @Expose() type: MediaType;
  @Expose() metadata: Prisma.JsonValue;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
  @Exclude() publicId: string;
  constructor(partial: Partial<Media>) {
    Object.assign(this, partial);
  }
}
