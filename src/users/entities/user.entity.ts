import { $Enums, User } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

export class UserEntity implements User {
  @Expose() id: string;

  @Expose() firstName: string;

  @Expose() lastName: string;

  @Expose() avatar: string;

  @Expose() email: string;

  @Expose() role: $Enums.Role;

  @Expose() updatedAt: Date;

  @Expose() createdAt: Date;

  @Exclude() password: string;

  @Expose() get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
