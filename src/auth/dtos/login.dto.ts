import { VerificationTokenType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ToE164 } from 'src/common/decorators/to-e164.decorator';

export class LoginDto {
  // Email OU numéro de téléphone : le compte est résolu côté service en
  // testant les deux colonnes. `sendOptTo` ne désigne que le canal d'envoi
  // de l'OTP (EMAIL par défaut), pas la nature de l'identifiant.
  // ToE164 ne touche qu'un identifiant qui se parse comme un numéro (un
  // email passe tel quel) : « +33 7 63 93 34 58 » retrouve le compte
  // stocké sous sa forme canonique « +33763933458 ».
  @IsString()
  @IsNotEmpty()
  @ToE164()
  identifier: string;

  @IsEnum(VerificationTokenType)
  @IsOptional()
  sendOptTo?: VerificationTokenType;
}
