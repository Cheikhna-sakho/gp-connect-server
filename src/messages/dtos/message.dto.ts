import { Prisma } from '@prisma/client';
import { IsString, IsUUID } from 'class-validator';

export class CreateMessageDto implements Prisma.MessageUncheckedCreateInput {
  @IsString()
  content: string;
  @IsUUID()
  conversationId: string;
  @IsUUID()
  authorId: string;
  @IsUUID()
  recipientId: string;
}
