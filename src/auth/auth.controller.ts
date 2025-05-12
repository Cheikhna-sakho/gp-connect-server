import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenGuard } from './guards/refreshToken.guard';
import { CreateUserDto } from 'src/users/dtos/user.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { GetUser } from 'src/common/decorators/user.decorator';
import { JwtPayload } from './types/jwt.type';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { LoginEntity } from './entities/login.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { RefreshEntity } from './entities/refresh.entity';

@Public()
@Controller('auth')
export class AuthController {
  constructor(readonly authService: AuthService) {}

  @Post('login')
  @Serialize(LoginEntity)
  login(@Body() { email, password }: { email: string; password: string }) {
    return this.authService.login(email, password);
  }
  @Post('register')
  @Serialize(UserEntity)
  register(@Body() data: CreateUserDto) {
    return this.authService.register(data);
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @Serialize(RefreshEntity)
  refreshToken(@GetUser() user: JwtPayload) {
    return this.authService.refreshToken(user);
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
