import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt.type';
import { jwtConstants } from '../constants';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      algorithms: ['RS256'],
      secretOrKey: jwtConstants.REFRESH_TOKEN_PUBLIC,
    });
  }

  async validate({ id }: JwtPayload): Promise<JwtPayload> {
    return { id };
  }
}
