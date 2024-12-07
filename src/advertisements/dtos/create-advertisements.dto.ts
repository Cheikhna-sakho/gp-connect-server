import { $Enums, Prisma } from '@prisma/client';
import { IsDate, IsDecimal, IsEmpty, IsOptional } from 'class-validator';

export class CreateAdvertisementDto
  implements Prisma.AdvertisementUncheckedCreateInput
{
  @IsEmpty()
  authorId: string;
  @IsOptional()
  @IsDate()
  departureDate?: string | Date;
  @IsDate()
  arrivalDate: string | Date;
  @IsDecimal()
  price: number;
  @IsEmpty()
  departureId: string;
  @IsEmpty()
  destinationId: string;
  @IsEmpty()
  type?: $Enums.AdvertisementType;
  @IsOptional()
  @IsDecimal()
  maxWeight?: number;
}
