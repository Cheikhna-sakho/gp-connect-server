import { $Enums, Conversation } from '@prisma/client';

export class ConversationEntity implements Conversation {
  id: string;
  advertisementId: string;
  status: $Enums.ConversationStatus;
  lastMessageId: string;
  updatedAt: Date;
  createdAt: Date;

  constructor(partial: Partial<ConversationEntity>) {
    Object.assign(this, partial);
  }
}
