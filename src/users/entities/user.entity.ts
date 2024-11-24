import { $Enums, User } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

export class UserEntity implements User {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string;
  email: string;
  role: $Enums.Role;
  updatedAt: Date;
  createdAt: Date;

  @Exclude()
  password: string;
  @Expose()
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
