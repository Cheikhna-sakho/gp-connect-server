import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  // Borne alignée sur le contrat client (zod .max(500))
  @IsString()
  @IsOptional()
  @MaxLength(500)
  comment?: string;
}
