import { PickType } from '@nestjs/mapped-types';
import { VerificationTokenType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateUserDto } from 'src/users/dtos/create-user.dto';

export class LoginDto extends PickType(CreateUserDto, ['email']) {
  @IsEnum(VerificationTokenType)
  @IsOptional()
  sendOptTo: VerificationTokenType;
}
