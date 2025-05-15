import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { JwtPayload } from './types/jwt.type';
import { jwtConstants } from './constants';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}
  async signAccessTokenJwt(payload: JwtPayload) {
    return this.jwtService.sign(payload, {
      secret: jwtConstants.ACCESS_TOKEN_SECRET,
      expiresIn: process.env.ACCESS_TOKEN_EXP,
      algorithm: 'RS256',
    });
  }
  async signRefreshTokenJwt(payload: JwtPayload) {
    return this.jwtService.sign(payload, {
      secret: jwtConstants.REFRESH_TOKEN_SECRET,
      expiresIn: process.env.REFRESH_TOKEN_EXP,
      algorithm: 'RS256',
    });
  }
  async verifyPassword(password: string, hash: string) {
    try {
      const passed = await bcrypt.compare(password, hash);

      return passed;
    } catch (error) {
      console.log({ error });
      throw new BadRequestException('bizzare');
    }
  }
  async login(email: string, password: string) {
    const errorMessages = 'Invalid email or password.';
    const user = await this.usersService.findBy({ email });
    if (!user) {
      throw new UnauthorizedException(errorMessages);
    }
    // const isPasswordValid = await this.verifyPassword(password, user.password);
    // console.log({ error: 'password inc' });
    // if (!isPasswordValid) {
    //   throw new UnauthorizedException(errorMessages);
    // }
    delete user.password;
    const payload: JwtPayload = {
      id: user.id as UUID,
      email: user.email,
      role: user.role,
    };
    console.log({ success: 'reussi' });
    const accessToken = await this.signAccessTokenJwt(payload);
    const refreshToken = await this.signRefreshTokenJwt(payload);
    return { user, accessToken, refreshToken };
  }
  async register(data: Prisma.UserCreateInput) {
    return this.usersService.create({ data });
  }
  async refreshToken(user: JwtPayload) {
    return {
      accessToken: await this.signAccessTokenJwt(user),
    };
  }
}
