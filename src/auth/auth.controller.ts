import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Prisma } from '@prisma/client';
import { RefreshTokenGuard } from './guards/refreshToken.guard';
import { JwtPayload } from './types/jwt.type';

@Controller('auth')
export class AuthController {
  constructor(readonly authService: AuthService) {}

  @Get('login')
  loginG() {
    return 'this.authService.login(email, password);';
  }
  @Post('login')
  login(@Body() { email, password }: { email: string; password: string }) {
    return this.authService.login(email, password);
  }
  @Post('register')
  register(@Body() data: Prisma.UserCreateInput) {
    return this.authService.register(data);
  }
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  refreshToken(@Request() req: { user: JwtPayload }) {
    return this.authService.refreshToken(req.user);
  }
}
