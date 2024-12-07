import { Prisma } from '@prisma/client';
import { IsEmpty, IsString, IsUUID } from 'class-validator';

export class CreateMessageDto implements Prisma.MessageUncheckedCreateInput {
  @IsString()
  content: string;

  @IsUUID()
  conversationId: string;

  @IsUUID()
  @IsEmpty()
  authorId: string;
}
