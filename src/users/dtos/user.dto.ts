import { $Enums, Prisma } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class CreateUserDto implements Prisma.UserCreateInput {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsEnum($Enums.Role)
  @IsOptional()
  role?: $Enums.Role;
}
export class UpdateUserDto implements Prisma.UserUpdateInput {
  name: string;
  @IsEmail()
  email: string;
  @MinLength(8)
  // @IsStrongPassword()
  password: string;
  firstName: string;
  lastName: string;
}
