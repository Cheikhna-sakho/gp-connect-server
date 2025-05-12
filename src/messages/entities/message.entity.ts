import { $Enums, Message } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

export class MessageEntity implements Message {
  @Expose() id: string;

  @Expose() content: string;

  @Expose() conversationId: string;

  @Expose() authorId: string;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  mediaId: string;

  type: $Enums.MessageType;

  constructor(partial: Partial<MessageEntity>) {
    Object.assign(this, partial);
  }
}
