import { $Enums, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';
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
type Advertisement = Prisma.AdvertisementGetPayload<{
  include: typeof ADVERTISEMENT_DEFAULT_INCLUDE;
}>;
export class AdvertisementEntity implements Advertisement {
  @Expose() id: string;

  @Expose() type: $Enums.AdvertisementType;

  @Type(() => Number)
  @Expose()
  price: Decimal;

  @Type(() => Number)
  @Expose()
  maxWeight: Decimal;

  @Type(() => Number)
  @Expose()
  weight: Decimal;

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
  get reference() {
    return `ADV-${this.id.split('-')[0].toUpperCase()}`;
  }
  @Expose()
  @Type(() => MissionEntity)
  missions: MissionEntity[];
  @Expose()
  get cumulatedWeight() {
    return this.missions.reduce((total, { cumulatedWeight: weight }) => {
      total += weight;
      return total;
    }, 0);
  }
  @Expose()
  get packagesCount() {
    return this.missions.reduce((total, { packagesCount: len }) => {
      total += len;
      return total;
    }, 0);
  }
  constructor(partial: Partial<AdvertisementEntity>) {
    Object.assign(this, partial);
  }
}
