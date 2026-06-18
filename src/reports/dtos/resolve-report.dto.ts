import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// L'admin clôt un signalement. `OPEN` n'est pas une issue (statut initial).
export class ResolveReportDto {
  @IsIn(['REVIEWED', 'ACTION_TAKEN', 'DISMISSED'])
  status: 'REVIEWED' | 'ACTION_TAKEN' | 'DISMISSED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution?: string;
}
