import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { JwtPayload } from '../types/jwt.type';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get<Role[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const { user } = request;
    // JWT valide mais utilisateur disparu (compte supprimé) → 401, pas un
    // crash 500 sur le destructuring de null.
    const found = await this.usersService.findOne({ where: user });
    if (!found?.role) throw new UnauthorizedException();
    return roles.includes(found.role);
  }
}
