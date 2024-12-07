import { PickType } from '@nestjs/mapped-types';
import { LoginEntity } from './login.entity';

export class RefreshEntity extends PickType(LoginEntity, ['accessToken']) {}
