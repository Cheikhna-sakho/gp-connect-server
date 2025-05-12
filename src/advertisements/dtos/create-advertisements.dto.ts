import { IsEmpty, IsOptional } from 'class-validator';
import { AdvertisementDto } from './advertisement.dto';
import { Decimal } from '@prisma/client/runtime/library';

export class CreateAdvertisementDto extends AdvertisementDto {
  @IsOptional()
  maxWeight: Decimal;

  @IsEmpty()
  departureId: string;
  @IsEmpty()
  destinationId: string;
}
