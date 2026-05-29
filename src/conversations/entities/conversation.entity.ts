import {
  Advertisement,
  Conversation,
  ConversationStatus,
  User,
} from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import { AdvertisementEntity } from 'src/advertisements/entities/advertisement.entity';
import { MessageEntity } from 'src/messages/entities/message.entity';
import { MissionEntity } from 'src/missions/entities/mission.entity';
import { UserEntity } from 'src/users/entities/user.entity';

export class ConversationEntity implements Conversation {
  @Expose() id: string;

  @Expose() advertisementId: string;

  @Expose() status: ConversationStatus;

  @Expose() lastMessageAt: Date | null;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => AdvertisementEntity)
  @Expose()
  advertisement?: Advertisement;

  @Type(() => MessageEntity)
  @Expose()
  messages?: MessageEntity[];

  @Type(() => MessageEntity)
  @Expose()
  get lastMessage() {
    if (!this.messages?.length) return null;
    // Always return the most recent regardless of array sort order
    return [...this.messages].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  }

  @Type(() => UserEntity)
  @Expose()
  shipper: User;
  @Expose() shipperId: string;

  @Type(() => UserEntity)
  @Expose()
  carrier: User;
  @Expose() carrierId: string;

  @Expose() missionId: string | null;

  @Type(() => MissionEntity)
  @Expose()
  mission: MissionEntity;

  constructor(partial: Partial<ConversationEntity>) {
    Object.assign(this, partial);
  }
}
