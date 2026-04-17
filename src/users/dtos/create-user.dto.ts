import { PickType } from '@nestjs/mapped-types';
import { Prisma } from '@prisma/client';

import { UserDto } from './user.dto';

export class CreateUserDto
  extends PickType(UserDto, [
    'email',
    'phone',
    'password',
    'firstName',
    'lastName',
    'role',
  ])
  implements Prisma.UserCreateInput {}
