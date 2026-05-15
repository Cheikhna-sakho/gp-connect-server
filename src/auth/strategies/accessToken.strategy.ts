import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt.type';
import { jwtConstants } from '../constants';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.at ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(), // fallback pour les clients mobiles
      ]),
      algorithms: ['RS256'],
      secretOrKey: jwtConstants.ACCESS_TOKEN_PUBLIC,
    });
  }

  async validate({ id }: JwtPayload) {
    return { id };
  }
}
