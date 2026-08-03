import { VerificationTokenType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ToE164 } from 'src/common/decorators/to-e164.decorator';

// Vérification de l'OTP de connexion. `type` est un enum validé : sans DTO, le
// body inline échappait au ValidationPipe et partait tel quel vers le `where`
// Prisma. `identifier` est canonisé (même logique que LoginDto).
export class OtpDto {
  @IsString()
  @IsNotEmpty()
  @ToE164()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(VerificationTokenType)
  type: VerificationTokenType;
}
