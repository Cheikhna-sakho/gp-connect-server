import {
  $Enums,
  MissionProof,
  Prisma,
  Transaction,
  User,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Transform, Type } from 'class-transformer';
import { MissionPackageEntity } from './mission-package.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { CityEntity } from 'src/addresses/entities/city.entity';

// Used for list endpoints — lightweight (no proof images, no transaction)
export const MISSION_DEFAULT_INCLUDE = {
  packages: { select: { package: true } },
  advertisement: {
    select: {
      departure: {
        select: { city: { select: { name: true, countryIsoCode: true } } },
      },
      destination: {
        select: { city: { select: { name: true, countryIsoCode: true } } },
      },
    },
  },
} as const;

// Adresse complète (rue + coords + ville) — réservée aux participants d'une
// mission via le détail (findOneForUser est scopé shipper/carrier). Permet au
// carrier de connaître le point de ramassage/livraison exact.
const FULL_ADDRESS_SELECT = {
  select: {
    street: true,
    zipCode: true,
    latitude: true,
    longitude: true,
    city: { select: { name: true, country: true, countryIsoCode: true } },
  },
} as const;

// Used for detail endpoint — full data
export const MISSION_DETAIL_INCLUDE = {
  packages: { select: { package: true } },
  transaction: true,
  advertisement: {
    select: {
      departure: FULL_ADDRESS_SELECT,
      destination: FULL_ADDRESS_SELECT,
    },
  },
  proofs: {
    include: {
      images: {
        include: { image: true },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
} as const;
type Mission = Prisma.MissionGetPayload<{
  include: typeof MISSION_DETAIL_INCLUDE;
}>;

// Adresse d'annonce (départ/arrivée) telle qu'exposée dans une mission.
// latitude/longitude sont des Decimal Prisma : SANS `@Type(() => Number)`,
// class-transformer récurse dans l'instance Decimal et tente de la reconstruire
// via `new Decimal()` (sans argument) → DecimalError. Le typage explicite en
// Number est donc obligatoire — un `@Transform` sur l'objet parent ne suffit
// pas car la récursion (et le crash) a lieu AVANT que le transform ne s'exécute.
class MissionAdAddressEntity {
  @Expose() street: string;
  @Expose() zipCode: string;

  @Type(() => Number)
  @Expose()
  latitude: Decimal;

  @Type(() => Number)
  @Expose()
  longitude: Decimal;

  @Type(() => CityEntity)
  @Expose()
  city: CityEntity;
}

class MissionAdvertisementEntity {
  @Type(() => MissionAdAddressEntity)
  @Expose()
  departure: MissionAdAddressEntity;

  @Type(() => MissionAdAddressEntity)
  @Expose()
  destination: MissionAdAddressEntity;
}

export class MissionEntity implements Mission {
  @Expose() id: string;

  @Expose() advertisementId: string;

  @Expose()
  @Type(() => Number)
  negotiatedPrice: Decimal;

  @Expose() status: $Enums.MissionStatus;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => MissionPackageEntity)
  packages: MissionPackageEntity[];

  @Expose()
  get cumulatedWeight() {
    return this.packages
      ?.map(({ package: p }) => p.weight)
      .reduce((total, weight) => {
        total += Number(weight);
        return total;
      }, 0);
  }

  @Expose()
  get packagesCount() {
    return this.packages?.length ?? 0;
  }

  @Expose() shipperId: string;
  @Type(() => UserEntity)
  @Expose()
  shipper: User;

  @Expose() carrierId: string;
  @Type(() => UserEntity)
  @Expose()
  carrier: User;

  // Destinataire à destination (visible des deux parties de la mission)
  @Expose() recipientName: string | null;
  @Expose() recipientPhone: string | null;

  // proofs avec leurs images — transformé en { type → url[] } pour le frontend
  @Expose()
  @Transform(
    ({
      value,
    }: {
      value?: (MissionProof & { images: { image: { url: string } }[] })[];
    }) => {
      if (!Array.isArray(value)) return undefined;
      return value.reduce<Record<string, string[]>>((acc, proof) => {
        acc[proof.type] = proof.images
          .map((pi) => pi.image?.url)
          .filter(Boolean);
        return acc;
      }, {});
    },
    // toPlainOnly : sinon la double sérialisation (route @Serialize +
    // ClassSerializerInterceptor global) rejoue ce transform sur son propre
    // résultat ({type → url[]}, non-array) → proofs devient `undefined`.
    { toPlainOnly: true },
  )
  proofs: any[];

  // Advertisement — city only (list view) ou adresse complète (detail view).
  // Typé explicitement (cf. MissionAdAddressEntity) pour que class-transformer
  // convertisse les Decimal latitude/longitude en Number au lieu de crasher.
  @Type(() => MissionAdvertisementEntity)
  @Expose()
  advertisement: MissionAdvertisementEntity;

  // Transaction — only present on detail view
  @Expose()
  @Type(() => TransactionEntity)
  transaction: Transaction | null;

  constructor(partial: Partial<MissionEntity>) {
    Object.assign(this, partial);
  }
}
