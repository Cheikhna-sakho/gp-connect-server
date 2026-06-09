import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RefreshTokenGuard } from './guards/refreshToken.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { GetUser } from 'src/common/decorators/user.decorator';
import { JwtPayload } from './types/jwt.type';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { UserEntity } from 'src/users/entities/user.entity';
import { GoogleAuthGuard } from './guards/google.guard';
import { Request, Response } from 'express';
import { CreateUserDto } from 'src/users/dtos/create-user.dto';
import { LoginDto } from './dtos/login.dto';
import { VerificationTokenType } from '@prisma/client';
import {
  AppleTokenDto,
  FacebookTokenDto,
  GoogleTokenDto,
} from './dtos/oauth-token.dto';

// Réutilisé sur plusieurs endpoints — déclenche envoi SMS/email
const AUTH_THROTTLE = { default: { limit: 225, ttl: 60_000 } }; // LIMIT 5
// Spécifique OTP : correspond à la durée de vie du code (15 min)
const OTP_THROTTLE = { default: { limit: 5, ttl: 900_000 } };

const IS_PROD = process.env.NODE_ENV === 'production';

// En prod, front (Vercel) et back (Railway) sont cross-site : un cookie
// SameSite=Lax ne serait pas envoyé par les requêtes XHR du front. On passe
// donc à SameSite=None (qui impose Secure). En local on garde Lax.
const SAME_SITE = IS_PROD ? ('none' as const) : ('lax' as const);

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: SAME_SITE,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 1 jour
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: SAME_SITE,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
};

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie('at', accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('rt', refreshToken, REFRESH_COOKIE_OPTIONS);
}

function clearAuthCookies(res: Response) {
  res.clearCookie('at', { path: '/' });
  res.clearCookie('rt', { path: '/' });
}

@Public()
@Controller('auth')
export class AuthController {
  constructor(readonly authService: AuthService) {}

  // ─── OTP / Email ──────────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(AUTH_THROTTLE)
  login(@Body() data: LoginDto) {
    console.log({ data });
    return this.authService.login(data);
  }

  @Post('register')
  @Serialize(UserEntity)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  register(@Body() data: CreateUserDto) {
    return this.authService.register(data);
  }

  @Post('otp')
  @Serialize(UserEntity)
  @Throttle(OTP_THROTTLE)
  async otp(
    @Res({ passthrough: true }) res: Response,
    @Body()
    {
      code,
      type,
      email,
    }: { email: string; code: string; type: VerificationTokenType },
  ) {
    const { user, accessToken, refreshToken } = await this.authService.loginOpt(
      { email, code, type },
    );
    setAuthCookies(res, accessToken, refreshToken);
    return user;
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  async refreshToken(
    @Res({ passthrough: true }) res: Response,
    @GetUser() user: JwtPayload,
  ) {
    const { accessToken } = await this.authService.refreshToken(user);
    res.cookie('at', accessToken, ACCESS_COOKIE_OPTIONS);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookies(res);
  }

  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  // ─── Google web OAuth (redirection plein écran) ──────────────────────────
  // Flux : le front navigue vers /auth/google (pas de popup). Au retour de
  // Google, on pose le cookie de session puis on renvoie le navigateur vers
  // une page de callback du front, qui chargera l'utilisateur via /users/me.
  // Le back reste ainsi indépendant de la structure de données du front.

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    try {
      const { accessToken, refreshToken } =
        await this.authService.validateOAuthLoginGoogle(
          req.user as { providerUserId: string; email?: string; name?: string },
        );
      // Pose at + rt comme les autres flux, pour que le refresh transparent
      // fonctionne (sinon déconnexion à l'expiration de l'access token).
      setAuthCookies(res, accessToken, refreshToken);
      res.redirect(`${frontendUrl}/auth/callback`);
    } catch {
      res.redirect(`${frontendUrl}/auth/callback?error=oauth`);
    }
  }

  // ─── Google mobile ────────────────────────────────────────────────────────

  @Post('google/token')
  @Serialize(UserEntity)
  @Throttle(AUTH_THROTTLE)
  async googleToken(
    @Res({ passthrough: true }) res: Response,
    @Body() { idToken }: GoogleTokenDto,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.validateGoogleToken(idToken);
    setAuthCookies(res, accessToken, refreshToken);
    return user;
  }

  // ─── Apple Sign In ────────────────────────────────────────────────────────

  @Post('apple')
  @Serialize(UserEntity)
  @Throttle(AUTH_THROTTLE)
  async apple(
    @Res({ passthrough: true }) res: Response,
    @Body() { identityToken, firstName, lastName }: AppleTokenDto,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.validateAppleToken(
        identityToken,
        firstName,
        lastName,
      );
    setAuthCookies(res, accessToken, refreshToken);
    return user;
  }

  // ─── Facebook ─────────────────────────────────────────────────────────────

  @Post('facebook')
  @Serialize(UserEntity)
  @Throttle(AUTH_THROTTLE)
  async facebook(
    @Res({ passthrough: true }) res: Response,
    @Body() { accessToken }: FacebookTokenDto,
  ) {
    const {
      user,
      accessToken: at,
      refreshToken,
    } = await this.authService.validateFacebookToken(accessToken);
    setAuthCookies(res, at, refreshToken);
    return user;
  }
}
