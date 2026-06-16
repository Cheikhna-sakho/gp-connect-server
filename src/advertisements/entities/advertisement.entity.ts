import { $Enums, AdvertisementStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, plainToInstance, Transform, Type } from 'class-transformer';
import {
  ADDRESS_DEFAULT_INCLUDE,
  AddressEntity,
} from 'src/addresses/entities/addresses.entity';
import {
  MISSION_DEFAULT_INCLUDE,
  MissionEntity,
} from 'src/missions/entities/mission.entity';
import {
  USER_DEFAULT_INCLUDE,
  UserEntity,
} from 'src/users/entities/user.entity';

export const ADVERTISEMENT_DEFAULT_INCLUDE = {
  author: { include: USER_DEFAULT_INCLUDE },
  missions: { select: MISSION_DEFAULT_INCLUDE },
  departure: { include: ADDRESS_DEFAULT_INCLUDE },
  destination: { include: ADDRESS_DEFAULT_INCLUDE },
};
export const ADVERTISEMENT_CONVERSATION_INCLUDE = {
  select: {
    messages: {
      select: {
        createdAt: true,
        offer: true,
        author: { select: { firstName: true, lastName: true, id: true } },
      },
      where: { offer: { status: 'PENDING' } },
    },
  },
} as const;
type Advertisement = Prisma.AdvertisementGetPayload<{
  include: typeof ADVERTISEMENT_DEFAULT_INCLUDE;
}>;
type AdvertisementConversation = Prisma.ConversationGetPayload<
  typeof ADVERTISEMENT_CONVERSATION_INCLUDE
>[];
export class AdvertisementEntity implements Advertisement {
  @Expose() id: string;

  @Expose() type: $Enums.AdvertisementType;

  @Expose() status: AdvertisementStatus;

  @Type(() => Number)
  @Expose()
  price: Decimal;

  @Type(() => Number)
  @Expose()
  maxWeight: Decimal;

  @Expose() destinationId: string;

  @Expose() departureId: string;

  @Expose() authorId: string;

  @Type(() => Date)
  @Expose()
  departureDate: Date;

  @Type(() => Date)
  @Expose()
  arrivalDate: Date;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  @Type(() => UserEntity)
  @Expose()
  author: UserEntity;

  @Type(() => AddressEntity)
  @Expose()
  departure: AddressEntity;

  @Type(() => AddressEntity)
  @Expose()
  destination: AddressEntity;

  @Expose()
  @Type(() => MissionEntity)
  missions: MissionEntity[];

  // Les missions annulées ne comptent pas dans la capacité/les colis affichés
  private get activeMissions() {
    return this.missions?.filter((m) => m.status !== 'CANCELLED');
  }

  @Expose()
  get cumulatedWeight() {
    return (
      this.activeMissions?.reduce((total, { cumulatedWeight: weight }) => {
        total += weight ?? 0;
        return total;
      }, 0) ?? 0
    );
  }

  @Expose()
  get packagesCount() {
    return (
      this.activeMissions?.reduce((total, { packagesCount: len }) => {
        total += len ?? 0;
        return total;
      }, 0) ?? 0
    );
  }

  @Expose()
  @Transform(
    ({
      obj,
    }: {
      obj: Partial<
        AdvertisementEntity & {
          conversations?: AdvertisementConversation;
        }
      >;
    }) =>
      obj.conversations
        ?.map((c) =>
          c.messages?.map(({ createdAt, ...m }) => ({
            ...m.offer,
            createdAt,
            author: plainToInstance(UserEntity, m.author),
          })),
        )
        ?.flat(),
  )
  offers: {
    // replace by Entity and use type
    createdAt: Date;
    author: UserEntity;
    id: string;
    price: Prisma.Decimal;
    weight: Prisma.Decimal;
    missionId: string | null;
    status: $Enums.MessageOfferStatus;
    updatedAt: Date;
  }[];
  constructor(
    partial: Partial<
      AdvertisementEntity & {
        conversations?: AdvertisementConversation;
      }
    >,
  ) {
    Object.assign(this, partial);
  }
}
