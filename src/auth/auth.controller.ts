import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenGuard } from './guards/refreshToken.guard';
import { CreateUserDto } from 'src/users/dtos/user.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { GetUser } from 'src/common/decorators/user.decorator';
import { JwtPayload } from './types/jwt.type';

@Public()
@Controller('auth')
export class AuthController {
  constructor(readonly authService: AuthService) {}

  @Post('login')
  login(@Body() { email, password }: { email: string; password: string }) {
    return this.authService.login(email, password);
  }
  @Post('register')
  register(@Body() data: CreateUserDto) {
    console.log(data);
    return this.authService.register(data);
  }
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  refreshToken(@GetUser() user: JwtPayload) {
    return this.authService.refreshToken(user);
  }
}
