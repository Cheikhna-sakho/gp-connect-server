import { IsNotEmpty, IsString } from 'class-validator';

// Corps des routes de vérification de preuve (POST .../verify/pickup|delivery).
// Indispensable : sans classe DTO, le ValidationPipe ne s'applique pas et `code`
// arrive non validé (peut être absent / non-string → 500 sur bcrypt.compare).
export class VerifyProofDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
