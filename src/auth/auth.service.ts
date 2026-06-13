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
import { OAuth2Client } from 'google-auth-library';
import { createPublicKey, createVerify } from 'crypto';
import { ConfigService } from '@nestjs/config';

type OAuthProfile = {
  providerUserId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

type AppleJwk = { kid: string; kty: string; alg: string; n: string; e: string };

@Injectable()
export class AuthService {
  private providers: DatabaseService['userProvider'];
  private readonly googleClient: OAuth2Client;
  private appleJwksCache: { keys: AppleJwk[]; cachedAt: number } | null = null;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly config: ConfigService,
  ) {
    this.providers = this.databaseService.userProvider;
    this.googleClient = new OAuth2Client(config.get('GOOGLE_CLIENT_ID'));
  }

  // ─── JWT ──────────────────────────────────────────────────────────────────

  signAccessTokenJwt(payload: JwtPayload) {
    return this.jwtService.sign(payload, {
      secret: jwtConstants.ACCESS_TOKEN_SECRET,
      expiresIn: this.config.get('ACCESS_TOKEN_EXP'),
      algorithm: 'RS256',
    });
  }

  signRefreshTokenJwt(payload: JwtPayload) {
    return this.jwtService.sign(payload, {
      secret: jwtConstants.REFRESH_TOKEN_SECRET,
      expiresIn: this.config.get('REFRESH_TOKEN_EXP'),
      algorithm: 'RS256',
    });
  }

  async signTokenPair(userId: string) {
    const payload: JwtPayload = { id: userId as UUID };
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessTokenJwt(payload),
      this.signRefreshTokenJwt(payload),
    ]);
    return { accessToken, refreshToken };
  }

  async verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  // ─── OTP-based login ──────────────────────────────────────────────────────

  async login({ email, sendOptTo = VerificationTokenType.EMAIL }: LoginDto) {
    // identifier can be an email or a phone number (sendOptTo === PHONE)
    let user = await this.usersService.findByEmail(email);
    if (!user && sendOptTo === VerificationTokenType.PHONE) {
      user = await this.usersService.findOne({ where: { phone: email } });
    }
    if (!user) throw new UnauthorizedException('Invalid credentials');
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
      this.usersService.updateById(user.id, { emailVerifiedAt: new Date() });
    }
    return { user, ...(await this.signTokenPair(user.id)) };
  }

  async register(data: Prisma.UserCreateInput) {
    const user = await this.usersService.create({ data });
    // Vérif SMS seulement si un téléphone est renseigné (désactivé à
    // l'inscription tant que TWILIO_FROM n'est pas configuré).
    if (user.phone) {
      await this.usersService.sendPhoneVerification(user.id);
    }
    await this.usersService.sendEmailVerification(user.id);
    return user;
  }

  async refreshToken(user: JwtPayload) {
    return { accessToken: await this.signAccessTokenJwt(user) };
  }

  async verifyEmail(token: string) {
    return this.usersService.verifyEmailToken(token);
  }

  // ─── Generic OAuth handler (shared by all providers) ──────────────────────

  async validateOAuthLogin(profile: OAuthProfile, provider: AuthProvider) {
    const { providerUserId, email, firstName = '', lastName = '' } = profile;

    const userProvider = await this.providers.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: true },
    });

    let user = userProvider?.user;

    if (!user && email) {
      user = await this.usersService.findOne({ where: { email } });
    }

    if (!user) {
      user = await this.usersService.create({
        data: {
          email: email ?? `${provider}-${providerUserId}@noemail.gpconnect`,
          firstName,
          lastName,
          emailVerifiedAt: email ? new Date() : null,
        },
      });
    }

    if (!userProvider) {
      await this.providers.create({
        data: { userId: user.id, provider, providerUserId, email },
      });
    }

    return user;
  }

  // ─── Google web OAuth callback ─────────────────────────────────────────────

  async validateOAuthLoginGoogle(profile: {
    providerUserId: string;
    email?: string;
    name?: string;
  }) {
    const user = await this.validateOAuthLogin(
      {
        providerUserId: profile.providerUserId,
        email: profile.email,
        firstName: profile.name?.split(' ')[0],
        lastName: profile.name?.split(' ').slice(1).join(' '),
      },
      AuthProvider.GOOGLE,
    );
    const { accessToken, refreshToken } = await this.signTokenPair(user.id);
    return { user, accessToken, refreshToken };
  }

  // ─── Google mobile — verify idToken from Google Sign-In SDK ───────────────

  async validateGoogleToken(idToken: string) {
    let sub: string;
    let email: string | undefined;
    let givenName: string | undefined;
    let familyName: string | undefined;

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.config.get('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (!payload) throw new Error('Empty payload');
      sub = payload.sub;
      email = payload.email;
      givenName = payload.given_name;
      familyName = payload.family_name;
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const user = await this.validateOAuthLogin(
      {
        providerUserId: sub,
        email,
        firstName: givenName,
        lastName: familyName,
      },
      AuthProvider.GOOGLE,
    );
    return { user, ...(await this.signTokenPair(user.id)) };
  }

  // ─── Apple Sign In — verify identityToken (RS256 JWT) ────────────────────

  private async getAppleJwks(): Promise<AppleJwk[]> {
    const ONE_HOUR = 60 * 60 * 1000;
    if (
      this.appleJwksCache &&
      Date.now() - this.appleJwksCache.cachedAt < ONE_HOUR
    ) {
      return this.appleJwksCache.keys;
    }
    const res = await fetch('https://appleid.apple.com/auth/keys');
    const { keys } = (await res.json()) as { keys: AppleJwk[] };
    this.appleJwksCache = { keys, cachedAt: Date.now() };
    return keys;
  }

  async validateAppleToken(
    identityToken: string,
    firstName?: string,
    lastName?: string,
  ) {
    const parts = identityToken.split('.');
    if (parts.length !== 3)
      throw new UnauthorizedException('Malformed Apple token');

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    if (claims.iss !== 'https://appleid.apple.com') {
      throw new UnauthorizedException('Invalid Apple token issuer');
    }
    if (Date.now() / 1000 > claims.exp) {
      throw new UnauthorizedException('Apple token expired');
    }
    const clientId = this.config.get('APPLE_CLIENT_ID');
    if (clientId && claims.aud !== clientId) {
      throw new UnauthorizedException('Apple token audience mismatch');
    }

    const keys = await this.getAppleJwks();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) throw new UnauthorizedException('Apple signing key not found');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publicKey = createPublicKey({ key: jwk as any, format: 'jwk' });
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    const valid = verifier.verify(publicKey, parts[2], 'base64url');
    if (!valid)
      throw new UnauthorizedException('Invalid Apple token signature');

    const user = await this.validateOAuthLogin(
      { providerUserId: claims.sub, email: claims.email, firstName, lastName },
      AuthProvider.APPLE,
    );
    return { user, ...(await this.signTokenPair(user.id)) };
  }

  // ─── Facebook — verify accessToken via Graph API ──────────────────────────

  async validateFacebookToken(accessToken: string) {
    const fields = 'id,email,first_name,last_name';
    const url = `https://graph.facebook.com/me?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;

    const res = await fetch(url);
    if (!res.ok) throw new UnauthorizedException('Invalid Facebook token');

    const data = (await res.json()) as {
      id?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      error?: { message: string };
    };

    if (data.error || !data.id)
      throw new UnauthorizedException(
        data.error?.message ?? 'Facebook auth failed',
      );

    const user = await this.validateOAuthLogin(
      {
        providerUserId: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
      },
      AuthProvider.FACEBOOK,
    );
    return { user, ...(await this.signTokenPair(user.id)) };
  }
}
