import { $Enums, Address, Advertisement, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';
import { AddressEntity } from 'src/addresses/entities/addresses.entity';
import { UserEntity } from 'src/users/entities/user.entity';

export class AdvertisementEntity implements Advertisement {
  @Expose() id: string;

  @Expose() type: $Enums.AdvertisementType;

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
  author: User;

  @Type(() => AddressEntity)
  @Expose()
  departure: Address;

  @Type(() => AddressEntity)
  @Expose()
  destination: Address;

  constructor(partial: Partial<AdvertisementEntity>) {
    Object.assign(this, partial);
  }
}
