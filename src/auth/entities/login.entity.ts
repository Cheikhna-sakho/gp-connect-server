import { User } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import { UserEntity } from 'src/users/entities/user.entity';

export class LoginEntity {
  @Expose()
  @Type(() => UserEntity)
  user: User;

  @Expose() accessToken: string;

  @Expose() refreshToken: string;
  constructor(partial: Partial<LoginEntity>) {
    Object.assign(this, partial);
  }
}
