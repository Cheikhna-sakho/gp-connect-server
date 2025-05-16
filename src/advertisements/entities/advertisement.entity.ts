import { $Enums, Address, Prisma, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';
import { AddressEntity } from 'src/addresses/entities/addresses.entity';
import { MissionEntity } from 'src/missions/entities/mission.entity';
import { UserEntity } from 'src/users/entities/user.entity';
type Advertisement = Prisma.AdvertisementGetPayload<{
  include: {
    missions: { select: { packages: { select: { package: true } } } };
  };
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
  author: User;

  @Type(() => AddressEntity)
  @Expose()
  departure: Address;

  @Type(() => AddressEntity)
  @Expose()
  destination: Address;

  @Expose()
  get reference() {
    return `ADV-${this.id.split('-')[0].toUpperCase()}`;
  }
  @Expose()
  @Type(() => MissionEntity)
  missions: MissionEntity[];
  @Expose()
  get cumulatedWeight() {
    return this.missions
      ?.map(({ packages }) => packages.map(({ package: p }) => p.weight))
      .flat()
      .reduce((total, weight) => {
        total += Number(weight);
        console.log({ total });
        return total;
      }, 0);
  }
  @Expose()
  get packagesCount() {
    return this.missions
      ?.map(({ packages }) => packages.length)
      .reduce((total, len) => {
        total += len;
        return total;
      }, 0);
  }
  constructor(partial: Partial<AdvertisementEntity>) {
    Object.assign(this, partial);
  }
}
