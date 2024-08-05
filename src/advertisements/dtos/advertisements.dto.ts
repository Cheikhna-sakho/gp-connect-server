import { $Enums, Prisma } from '@prisma/client';
import { DecimalJsLike } from '@prisma/client/runtime/library';
import { IsEmpty, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateAdvertisementDto
  implements Prisma.AdvertisementUncheckedCreateInput
{
  @IsEmpty()
  authorId: string;
  @IsOptional()
  departureDate?: string | Date;
  @IsNotEmpty()
  arrivalDate: string | Date;
  @IsNotEmpty()
  price?: string | number | Prisma.Decimal | DecimalJsLike;
  @IsOptional()
  departureId: string;
  @IsOptional()
  destinationId: string;
  @IsOptional()
  departure: Prisma.AddressCreateInput;
  @IsOptional()
  destination: Prisma.AddressCreateInput;
  @IsEmpty()
  type?: $Enums.AdvertisementType;
}
// export class UpdateMissionDto implements Prisma.MissionUpdateInput {}
