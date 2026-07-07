import { $Enums, AdvertisementStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, plainToInstance, Transform, Type } from 'class-transformer';
import { ADDRESS_DEFAULT_INCLUDE } from 'src/addresses/entities/addresses.entity';
import { PublicAddressEntity } from 'src/addresses/entities/public-address.entity';
import {
  MISSION_DEFAULT_INCLUDE,
  MissionEntity,
} from 'src/missions/entities/mission.entity';
import { USER_DEFAULT_INCLUDE } from 'src/users/entities/user.entity';
import { PublicUserEntity } from 'src/users/entities/public-user.entity';

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

// Forme brute (source) des missions de l'annonce, pour dériver la capacité sans
// exposer l'objet mission (PII / internes).
type RawAdMission = {
  status: $Enums.MissionStatus;
  packages?: { package?: { weight?: unknown } }[];
};
const activeAdMissions = (obj: { missions?: RawAdMission[] }) =>
  (obj.missions ?? []).filter((m) => m.status !== 'CANCELLED');

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

  // Vue publique : pas d'email/téléphone de l'auteur (annonce listée sans auth).
  // Le type reste le payload Prisma (pour `implements`), `@Type` pilote la
  // sérialisation vers la vue publique.
  @Type(() => PublicUserEntity)
  @Expose()
  author: Advertisement['author'];

  // Vue publique des adresses : pas de coordonnées GPS précises (anti-géoloc).
  // Le type reste le payload Prisma (pour `implements`), `@Type` pilote la
  // sérialisation vers la vue publique.
  @Type(() => PublicAddressEntity)
  @Expose()
  departure: Advertisement['departure'];

  @Type(() => PublicAddressEntity)
  @Expose()
  destination: Advertisement['destination'];

  // `missions` n'est PAS exposé : il porte des PII (recipientName/Phone) et des
  // détails de mission qui n'ont rien à faire sur une annonce publique. On n'en
  // dérive que des indicateurs de capacité agrégés ci-dessous (lus sur la source
  // brute via @Transform — les missions ne quittent jamais le back).
  missions: MissionEntity[];

  @Expose()
  @Transform(({ obj }: { obj: { missions?: RawAdMission[] } }) =>
    activeAdMissions(obj).reduce(
      (total, m) =>
        total +
        (m.packages ?? []).reduce(
          (sum, mp) => sum + Number(mp.package?.weight ?? 0),
          0,
        ),
      0,
    ),
  )
  cumulatedWeight: number;

  @Expose()
  @Transform(({ obj }: { obj: { missions?: RawAdMission[] } }) =>
    activeAdMissions(obj).reduce(
      (total, m) => total + (m.packages?.length ?? 0),
      0,
    ),
  )
  packagesCount: number;

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
            author: plainToInstance(PublicUserEntity, m.author),
          })),
        )
        ?.flat(),
  )
  offers: {
    // replace by Entity and use type
    createdAt: Date;
    author: PublicUserEntity;
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
