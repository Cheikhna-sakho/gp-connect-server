import { User } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import { UserEntity } from 'src/users/entities/user.entity';

// Les tokens ne sont plus exposés dans le body — ils sont en cookies httpOnly
export class LoginEntity {
  @Expose()
  @Type(() => UserEntity)
  user: User;

  constructor(partial: Partial<LoginEntity>) {
    Object.assign(this, partial);
  }
}
