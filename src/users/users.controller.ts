import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UUID } from 'crypto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { UserEntity } from './entities/user.entity';
import { UserStatsEntity } from './entities/user-stats.entity';
import { UserPreferencesEntity } from './entities/user-preferences.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaEntity } from 'src/medias/entities/media.entity';
import { UpdateUserDto } from './dtos/update-user-dto';
import { UpdatePreferencesDto } from './dtos/update-preferences.dto';
import { AddressEntity } from 'src/addresses/entities/addresses.entity';

@Controller('users')
export class UsersController {
  constructor(readonly usersService: UsersService) {}

  // ─── Profile ──────────────────────────────────────────────────────────────

  @Public()
  @Get(ID_PARAM)
  @Serialize(UserEntity)
  async getOneUser(@Param('id') id: UUID) {
    const user = await this.usersService.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Get('me')
  @Serialize(UserEntity)
  getMe(@GetUserId() id: UUID) {
    return this.usersService.findOne({ where: { id } });
  }

  @Post('avatar')
  @Serialize(MediaEntity)
  @UseInterceptors(FileInterceptor('avatar', { storage: memoryStorage() }))
  avatar(@GetUserId() id: UUID, @UploadedFile() avatar: Express.Multer.File) {
    return this.usersService.createAvatar(id, avatar);
  }

  @Post('verify/email')
  @HttpCode(HttpStatus.NO_CONTENT)
  verifyEmail(@Query('token') token: string) {
    return this.usersService.verifyEmailToken(token);
  }

  @Post('verify/email/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  resendVerification(@GetUserId() id: UUID) {
    return this.usersService.sendEmailVerification(id);
  }

  @Patch()
  @HttpCode(HttpStatus.NO_CONTENT)
  update(@GetUserId() id: UUID, @Body() data: UpdateUserDto) {
    return this.usersService.updateById(id, data);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(ID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  updateUser(@Param('id') id: UUID, @Body() data: UpdateUserDto) {
    return this.usersService.updateById(id, data);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(ID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@Param('id') id: UUID) {
    return this.usersService.delete({ where: { id } });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  @Get('me/stats')
  @Serialize(UserStatsEntity)
  getMyStats(@GetUserId() id: UUID) {
    return this.usersService.getStats(id);
  }

  @Public()
  @Get(`${ID_PARAM}/stats`)
  @Serialize(UserStatsEntity)
  getUserStats(@Param('id') id: UUID) {
    return this.usersService.getStats(id);
  }

  // ─── Notification preferences ─────────────────────────────────────────────

  @Get('me/preferences')
  @Serialize(UserPreferencesEntity)
  getPreferences(@GetUserId() id: UUID) {
    return this.usersService.getPreferences(id);
  }

  @Patch('me/preferences')
  @Serialize(UserPreferencesEntity)
  updatePreferences(@GetUserId() id: UUID, @Body() data: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(id, data);
  }

  // ─── Saved addresses ──────────────────────────────────────────────────────

  @Get('me/saved-addresses')
  @Serialize(AddressEntity)
  async getSavedAddresses(@GetUserId() id: UUID) {
    const saved = await this.usersService.getSavedAddresses(id);
    return saved.map((sa) => sa.address);
  }

  @Post(`me/saved-addresses/${SetIdParam('addressId')}`)
  @Serialize(AddressEntity)
  saveAddress(
    @GetUserId() id: UUID,
    @Param('addressId') addressId: string,
    @Body('label') label?: string,
  ) {
    return this.usersService.saveAddress(id, addressId, label);
  }

  @Delete(`me/saved-addresses/${SetIdParam('addressId')}`)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSavedAddress(@GetUserId() id: UUID, @Param('addressId') addressId: string) {
    return this.usersService.removeSavedAddress(id, addressId);
  }
}
