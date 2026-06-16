import { IsEmpty } from 'class-validator';
import { AdvertisementDto } from './advertisement.dto';

export class CreateAdvertisementDto extends AdvertisementDto {
  // maxWeight est hérité d'AdvertisementDto (optionnel, défaut 0 côté DB).
  @IsEmpty()
  departureId: string;
  @IsEmpty()
  destinationId: string;
}
