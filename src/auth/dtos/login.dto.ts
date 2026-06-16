import { VerificationTokenType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  // Email OU numéro de téléphone : le compte est résolu côté service en
  // testant les deux colonnes. `sendOptTo` ne désigne que le canal d'envoi
  // de l'OTP (EMAIL par défaut), pas la nature de l'identifiant.
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsEnum(VerificationTokenType)
  @IsOptional()
  sendOptTo?: VerificationTokenType;
}
