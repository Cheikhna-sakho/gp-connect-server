import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenGuard } from './guards/refreshToken.guard';
import { AuthRequest } from 'src/common/types/request.type';
import { CreateUserDto } from 'src/users/dtos/user.dto';
import { Public } from 'src/common/decorators/public.decorator';

@Public()
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
  register(@Body() data: CreateUserDto) {
    console.log(data);
    return this.authService.register(data);
  }
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  refreshToken(@Request() req: AuthRequest) {
    return this.authService.refreshToken(req.user);
  }
}
