import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt.type';
import { jwtConstants } from '../constants';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: (req: Request) => req?.cookies?.rt ?? null,
      algorithms: ['RS256'],
      secretOrKey: jwtConstants.REFRESH_TOKEN_PUBLIC,
    });
  }

  async validate({ id }: JwtPayload): Promise<JwtPayload> {
    return { id };
  }
}
