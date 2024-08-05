import { $Enums, Prisma, User } from '@prisma/client';
import { Exclude } from 'class-transformer';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto implements Prisma.UserCreateInput {
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @MinLength(8)
  @IsNotEmpty()
  // @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/,)
  password: string;
  @IsNotEmpty()
  firstName: string;
  @IsNotEmpty()
  lastName: string;
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
