import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsBoolean()
  @IsOptional()
  notifySms?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyEmail?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyPush?: boolean;
}
