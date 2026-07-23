import { ApiProperty } from '@nestjs/swagger';
import { $Enums, MessageOffer } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';
import { MissionEntity } from 'src/missions/entities/mission.entity';

export class MessageOfferEntity implements MessageOffer {
  @Expose() id: string;

  @Type(() => Number)
  @Expose()
  @ApiProperty({ type: Number })
  price: Decimal;

  @Type(() => Number)
  @Expose()
  @ApiProperty({ type: Number })
  weight: Decimal;

  @Expose() messageId: string;

  @Expose() missionId: string;

  @Type(() => MissionEntity)
  @Expose()
  mission: string;

  @Expose() status: $Enums.MessageOfferStatus;

  @Type(() => Date)
  createdAt: Date;

  @Type(() => Date)
  updatedAt: Date;

  constructor(partial: Partial<MessageOfferEntity>) {
    Object.assign(this, partial);
  }
}
