import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { JwtPayload } from './types/jwt.type';
import { jwtConstants } from './constants';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}
  async signAccessTokenJwt(payload: JwtPayload) {
    return this.jwtService.sign(payload, {
      secret: jwtConstants.ACCESS_TOKEN_SECRET,
      expiresIn: '5min',
      algorithm: 'RS256',
    });
  }
  async signRefreshTokenJwt(payload: JwtPayload) {
    return this.jwtService.sign(payload, {
      secret: jwtConstants.REFRESH_TOKEN_SECRET,
      expiresIn: '7d',
      algorithm: 'RS256',
    });
  }

  async hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }
  async verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }
  async login(email: string, password: string) {
    const user = await this.usersService.findBy({ email });
    if (!user) {
      throw new UnauthorizedException();
    }
    const isPasswordValid = await this.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }
    delete user.password;
    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.signAccessTokenJwt(payload);
    const refreshToken = await this.signRefreshTokenJwt(payload);
    return { user, accessToken, refreshToken };
  }
  async register(data: Prisma.UserCreateInput) {
    data.password = await this.hashPassword(data.password);
    this.usersService.create({ data });
  }
  async refreshToken(user: JwtPayload) {
    return {
      accessToken: await this.signAccessTokenJwt(user),
    };
  }
}
