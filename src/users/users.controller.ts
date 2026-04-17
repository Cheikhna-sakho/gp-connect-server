import {
  Controller,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UUID } from 'crypto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { UserEntity } from './entities/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaEntity } from 'src/medias/entities/media.entity';
import { UpdateUserDto } from './dtos/update-user-dto';

@Controller('users')
export class UsersController {
  constructor(readonly usersService: UsersService) {}

  @Serialize(UserEntity)
  @Public()
  @Get(ID_PARAM)
  getOneUser(@Param('id') id: UUID) {
    const user = this.usersService.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
  @Get('me')
  @Serialize(UserEntity)
  getMe(@GetUserId() id: UUID) {
    return this.usersService.findOne({ where: { id } });
  }

  @Post('avatar')
  @Serialize(MediaEntity)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
    }),
  )
  avatar(@GetUserId() id: UUID, @UploadedFile() avatar: Express.Multer.File) {
    return this.usersService.createAvatar(id, avatar);
  }

  @Post('verify/email')
  async verifyEmail(@Query('token') token: string) {
    return this.usersService.verifyEmailToken(token);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch()
  update(@GetUserId() id: UUID, @Body() data: UpdateUserDto) {
    return this.usersService.updateById(id, data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(ID_PARAM)
  updateUser(@Param('id') id: UUID, @Body() data: UpdateUserDto) {
    return this.usersService.updateById(id, data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(ID_PARAM)
  deleteUser(@Param('id') id: UUID) {
    return this.usersService.delete({ where: { id } });
  }
}
