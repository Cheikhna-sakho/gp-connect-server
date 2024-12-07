import { PickType } from '@nestjs/mapped-types';
import { CreateUserDto } from 'src/users/dtos/user.dto';

export class LoginDto extends PickType(CreateUserDto, ['email', 'password']) {}
