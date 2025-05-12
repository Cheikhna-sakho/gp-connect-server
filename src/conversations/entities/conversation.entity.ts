import { Advertisement, Conversation, User } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import { AdvertisementEntity } from 'src/advertisements/entities/advertisement.entity';
import { MessageEntity } from 'src/messages/entities/message.entity';
import { UserEntity } from 'src/users/entities/user.entity';

export class ConversationEntity implements Conversation {
  @Expose() id: string;

  @Expose() advertisementId: string;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => AdvertisementEntity)
  advertisement?: Advertisement;

  @Type(() => MessageEntity)
  @Expose()
  messages?: MessageEntity[];

  @Type(() => UserEntity)
  @Expose()
  shipper: User;
  shipperId: string;

  @Type(() => UserEntity)
  @Expose()
  carrier: User;
  carrierId: string;

  constructor(partial: Partial<ConversationEntity>) {
    Object.assign(this, partial);
  }
}
