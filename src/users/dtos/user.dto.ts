import { $Enums, Prisma, User } from '@prisma/client';
import { Exclude } from 'class-transformer';
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
export class FetchUserDto implements User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  role: $Enums.Role;
  avatar: string;
  @Exclude()
  password: string;
}
