import { $Enums } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

// PATCH /missions/:id — SEULS champs éditables manuellement par un participant.
// Tout le reste (advertisementId, negotiatedPrice, carrierId, timestamps) est
// dérivé serveur : les laisser passer permettait le mass-assignment (réécriture
// du prix négocié, rattachement à une autre annonce) et provoquait un 500 quand
// advertisementId pointait sur une annonce inexistante (violation de clé étrangère).
// La règle métier sur `status` (CANCELLED uniquement, hors DISPUTED) reste dans le contrôleur.
export class UpdateMissionDto {
  @IsOptional()
  @IsEnum($Enums.MissionStatus)
  status?: $Enums.MissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientName?: string;

  @IsOptional()
  @IsPhoneNumber()
  recipientPhone?: string;
}
