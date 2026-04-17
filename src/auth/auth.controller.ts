import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenGuard } from './guards/refreshToken.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { GetUser } from 'src/common/decorators/user.decorator';
import { JwtPayload } from './types/jwt.type';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { LoginEntity } from './entities/login.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { RefreshEntity } from './entities/refresh.entity';
import { GoogleAuthGuard } from './guards/google.guard';
import { Request } from 'express';
import { CreateUserDto } from 'src/users/dtos/create-user.dto';
import { LoginDto } from './dtos/login.dto';
import { VerificationTokenType } from '@prisma/client';

@Public()
@Controller('auth')
export class AuthController {
  constructor(readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  login(@Body() data: LoginDto) {
    return this.authService.login(data);
  }
  @Post('register')
  @Serialize(UserEntity)
  register(@Body() data: CreateUserDto) {
    return this.authService.register(data);
  }

  @Post('otp')
  @Serialize(LoginEntity)
  opt(
    @Body()
    {
      code,
      type,
      email,
    }: {
      email: string;
      code: string;
      type: VerificationTokenType;
    },
  ) {
    return this.authService.loginOpt({ email, code, type });
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Passport fait la redirection automatiquement
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: Request) {
    const profile = req.user; // payload renvoyé par GoogleStrategy.validate
    const { accessToken } = await this.authService.validateOAuthLoginGoogle(
      profile as {
        providerUserId: string;
        email?: string;
        name?: string;
      }, //verifier si c'est le bon type retourner
    );

    // 2 possibilités :
    // - rediriger vers ton frontend avec le token en query
    // - ou mettre le token en cookie HTTP-only ici

    // Exemple simple : redirection frontend + token en query
    return `
      <script>
        window.opener.postMessage(${JSON.stringify({ accessToken })}, '*');
        window.close();
      </script>
    `;
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @Serialize(RefreshEntity)
  refreshToken(@GetUser() user: JwtPayload) {
    return this.authService.refreshToken(user);
  }

  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.verifyEmail(token);
  }
}
/**
 * end-point auth
 * prefix: auth
 * /login
 * /register
 * /refresh
 * entit
 */
