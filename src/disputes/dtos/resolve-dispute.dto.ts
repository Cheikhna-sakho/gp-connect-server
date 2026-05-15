import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class ResolveDisputeDto {
  @IsString()
  @IsNotEmpty()
  resolution: string;

  // What happens to the mission after resolution
  @IsEnum(['COMPLETED', 'CANCELLED'])
  missionOutcome: 'COMPLETED' | 'CANCELLED';
}
