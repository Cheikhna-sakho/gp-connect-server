import { PartialType } from '@nestjs/mapped-types';
import { $Enums } from '@prisma/client';
import { AdvertisementDto } from './advertisement.dto';
import { IsEmpty } from 'class-validator';

export class UpdateAdvertisementDto extends PartialType(AdvertisementDto) {
  @IsEmpty()
  authorId: string;

  // Non modifiables après création : le `type` conditionne la mission-dossier
  // créée atomiquement à la création (le changer laisserait un état incohérent),
  // et les adresses passent par createIfNotExist, pas par un PATCH d'annonce.
  @IsEmpty()
  type?: $Enums.AdvertisementType;

  @IsEmpty()
  departureId: string;

  @IsEmpty()
  destinationId: string;
}
