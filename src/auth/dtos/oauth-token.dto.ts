import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleTokenDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class AppleTokenDto {
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  // Apple only sends name on the very first sign-in — optional after that
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}

export class FacebookTokenDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
