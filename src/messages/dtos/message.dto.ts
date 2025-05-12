import { Prisma } from '@prisma/client';
import {
  IsArray,
  IsEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { UUID } from 'crypto';

export class CreateMessageDto implements Prisma.MessageUncheckedCreateInput {
  @IsString()
  content: string;

  @IsOptional()
  @IsUUID()
  conversationId: string;

  @IsUUID()
  advertisementId: string;

  @IsEmpty()
  authorId: string;

  @IsArray()
  @IsOptional()
  @IsUUID('4', { each: true })
  packagesIds: UUID[];
}
