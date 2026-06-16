import { $Enums, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/** Refuse une date située dans le passé (borne : début de la journée courante). */
@ValidatorConstraint({ name: 'notInPast' })
export class NotInPast implements ValidatorConstraintInterface {
  validate(value: Date) {
    if (!(value instanceof Date) || isNaN(value.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return value.getTime() >= today.getTime();
  }
  defaultMessage(args: ValidationArguments) {
    return `${args.property} ne peut pas être dans le passé`;
  }
}

/** Vérifie que departureDate (si fournie) est antérieure ou égale à arrivalDate. */
@ValidatorConstraint({ name: 'departureBeforeArrival' })
export class DepartureBeforeArrival implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const o = args.object as AdvertisementDto;
    if (!o.departureDate || !o.arrivalDate) return true;
    return (
      new Date(o.departureDate).getTime() <= new Date(o.arrivalDate).getTime()
    );
  }
  defaultMessage() {
    return 'departureDate doit être antérieure ou égale à arrivalDate';
  }
}

export class AdvertisementDto
  implements Prisma.AdvertisementUncheckedCreateInput
{
  @IsEnum($Enums.AdvertisementType)
  type?: $Enums.AdvertisementType;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price: Decimal;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxWeight: Decimal;

  @IsUUID()
  destinationId: string;

  @IsUUID()
  departureId: string;

  @IsEmpty()
  authorId: string;

  @IsDate()
  @IsOptional()
  @Validate(NotInPast)
  @Type(() => Date)
  departureDate?: Date;

  @IsDate()
  @Validate(NotInPast)
  @Validate(DepartureBeforeArrival)
  @Type(() => Date)
  arrivalDate: Date;
}
