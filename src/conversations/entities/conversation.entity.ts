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
import { PublicUserEntity } from 'src/users/entities/public-user.entity';

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

  // Vue publique : pas d'email/téléphone de l'autre partie (anti-fuite PII /
  // désintermédiation). Le client n'affiche que nom + avatar + trust.
  @Type(() => PublicUserEntity)
  @Expose()
  shipper: User;
  @Expose() shipperId: string;

  @Type(() => PublicUserEntity)
  @Expose()
  carrier: User;
  @Expose() carrierId: string;

  @Expose() missionId: string | null;

  // État interne de soft delete — volontairement NON exposé au client.
  shipperDeletedAt: Date | null;
  carrierDeletedAt: Date | null;

  @Type(() => MissionEntity)
  @Expose()
  mission: MissionEntity;

  constructor(partial: Partial<ConversationEntity>) {
    Object.assign(this, partial);
  }
}
