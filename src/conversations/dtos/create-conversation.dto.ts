import { Prisma } from '@prisma/client';
import { IsEmpty, IsUUID } from 'class-validator';

export class CreateConversationDto
  implements Prisma.ConversationUncheckedCreateInput
{
  @IsUUID()
  advertisementId: string;
  @IsEmpty()
  shipperId: string;
  @IsUUID()
  carrierId: string;
}
