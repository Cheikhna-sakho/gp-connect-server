import { Message } from '@prisma/client';
import { Type } from 'class-transformer';

export class MessageEntity implements Message {
  id: string;
  content: string;
  conversationId: string;
  authorId: string;
  recipientId: string;

  @Type(() => Date)
  createdAt: Date;
  @Type(() => Date)
  updatedAt: Date;
  constructor(partial: Partial<MessageEntity>) {
    Object.assign(this, partial);
  }
}
