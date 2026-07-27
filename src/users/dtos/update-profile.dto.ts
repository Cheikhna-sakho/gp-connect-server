import { $Enums } from '@prisma/client';
import { ToE164 } from 'src/common/decorators/to-e164.decorator';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';

// Champs que l'utilisateur peut modifier sur SON propre compte.
// Volontairement restreint : pas de `password`, ni de `*VerifiedAt`, ni de
// `id`/timestamps, et `role` borné à SHIPPER|CARRIER (jamais ADMIN) pour
// empêcher toute élévation de privilège ou contournement de vérification.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @ToE164()
  @IsPhoneNumber()
  phone?: string;

  @IsOptional()
  @IsEnum($Enums.Role)
  @IsIn([$Enums.Role.SHIPPER, $Enums.Role.CARRIER], {
    message: 'role must be SHIPPER or CARRIER',
  })
  role?: $Enums.Role;
}
