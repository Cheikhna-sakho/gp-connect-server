import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { JwtPayload } from './types/jwt.type';
import { jwtConstants } from './constants';
import * as bcrypt from 'bcrypt';
import { AuthProvider, Prisma, VerificationTokenType } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { LoginDto } from './dtos/login.dto';
@Injectable()
export class AuthService {
  private providers: DatabaseService['userProvider'];
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly databaseService: DatabaseService,
  ) {
    this.providers = this.databaseService.userProvider;
  }
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
    return bcrypt.compare(password, hash);
  }
  async login({ email, sendOptTo = VerificationTokenType.EMAIL }: LoginDto) {
    const errorMessages = 'Invalid email';
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException(errorMessages);
    }
    if (sendOptTo === VerificationTokenType.EMAIL) {
      return this.usersService.sendEmailOpt(user.id);
    }
    return this.usersService.sendPhoneVerification(user.id);
  }

  async loginOpt({
    code,
    type,
    email,
  }: {
    email: string;
    code: string;
    type: VerificationTokenType;
  }) {
    const user = await this.usersService.findByEmail(email);
    await this.usersService.verifyOtpToken(email, code, type);
    if (!user?.phoneVerifiedAt && type === VerificationTokenType.PHONE) {
      this.usersService.updateById(user.id, { phoneVerifiedAt: new Date() });
    }
    if (!user?.emailVerifiedAt && type === VerificationTokenType.EMAIL) {
      this.usersService.updateById(user.id, { phoneVerifiedAt: new Date() });
    }
    const payload: JwtPayload = { id: user.id as UUID };
    const accessToken = await this.signAccessTokenJwt(payload);
    const refreshToken = await this.signRefreshTokenJwt(payload);
    return { user, accessToken, refreshToken };
  }

  async register(data: Prisma.UserCreateInput) {
    const user = await this.usersService.create({ data });
    console.log({ user });
    await this.usersService.sendPhoneVerification(user.id);
    await this.usersService.sendEmailVerification(user.id);
    return user;
  }
  async refreshToken(user: JwtPayload) {
    return {
      accessToken: await this.signAccessTokenJwt(user),
    };
  }

  async validateOAuthLoginGoogle(profile: {
    providerUserId: string;
    email?: string;
    name?: string;
  }) {
    const { providerUserId, email, name } = profile;
    const userProvider = await this.providers.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.GOOGLE,
          providerUserId,
        },
      },
      include: { user: true },
    });

    let user = userProvider?.user;

    if (!user && email) {
      user = await this.usersService.findOne({ where: { email } });
    }

    if (!user) {
      user = await this.usersService.create({
        data: {
          email: email ?? `google-${providerUserId}@noemail.gpconnect`,
          firstName: name?.split(' ')[0] ?? '',
          lastName: name?.split(' ').slice(1).join(' ') ?? '',
          emailVerifiedAt: email ? new Date() : null,
        },
      });
    }

    if (!userProvider) {
      await this.providers.create({
        data: {
          userId: user.id,
          provider: AuthProvider.GOOGLE,
          providerUserId,
          email,
        },
      });
    }

    const payload = { id: user.id as UUID };
    const accessToken = await this.signAccessTokenJwt(payload);

    return { user, accessToken };
  }

  async verifyEmail(token: string) {
    return this.usersService.verifyEmailToken(token);
  }
}
