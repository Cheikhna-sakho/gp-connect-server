import { Message, User } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import { MessageEntity } from 'src/messages/entities/message.entity';
import { UserEntity } from 'src/users/entities/user.entity';

export class ConversationMessageAndParticipant {
  @Expose()
  @Type(() => MessageEntity)
  messages: Message;

  @Expose()
  @Type(() => UserEntity)
  participant: User;
}
