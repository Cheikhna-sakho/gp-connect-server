import { IsIn, IsOptional, IsString, Length } from 'class-validator';

// Motifs alignés sur les options du front (ActionsSection).
export const DISPUTE_REASONS = [
  'missing',
  'damaged',
  'late',
  'fraud',
  'other',
] as const;

export class CreateDisputeDto {
  @IsIn(DISPUTE_REASONS)
  reason: (typeof DISPUTE_REASONS)[number];

  // Optionnelle, mais bornée comme côté front (10–500) quand fournie.
  @IsString()
  @IsOptional()
  @Length(10, 500)
  description?: string;
}
