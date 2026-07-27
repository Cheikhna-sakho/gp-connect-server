import { $Enums, User } from '@prisma/client';
import { ToE164 } from 'src/common/decorators/to-e164.decorator';
import {
  IsDate,
  IsEmail,
  IsEmpty,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
} from 'class-validator';

const StrongPasswordConstraint = {
  minLength: 8,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
} as const;
export class UserDto implements User {
  @IsEmpty()
  id: string;

  @IsEmail()
  email: string;

  // Jamais settable par le client : posé par updateById, consommé par
  // verifyEmailToken (bascule différée du changement d'email).
  @IsEmpty()
  pendingEmail: string;

  @ToE164()
  @IsPhoneNumber()
  @IsOptional()
  phone: string;

  @IsOptional()
  @IsStrongPassword(StrongPasswordConstraint)
  password: string;

  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsEnum($Enums.Role)
  @IsOptional()
  role: $Enums.Role;

  @IsDate()
  @IsOptional()
  emailVerifiedAt: Date;

  @IsDate()
  @IsOptional()
  phoneVerifiedAt: Date;

  @IsDate()
  @IsOptional()
  idCardVerifiedAt: Date;

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;
}
