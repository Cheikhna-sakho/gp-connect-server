import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserVerificationService } from './user-verification.service';
import { UUID } from 'crypto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { UserEntity } from './entities/user.entity';
import { PublicUserEntity } from './entities/public-user.entity';
import { UserStatsEntity } from './entities/user-stats.entity';
import { UserPreferencesEntity } from './entities/user-preferences.entity';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaEntity } from 'src/medias/entities/media.entity';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UpdatePreferencesDto } from './dtos/update-preferences.dto';
import { AddressEntity } from 'src/addresses/entities/addresses.entity';

// Upload avatar : borne la taille (mémoire) et restreint aux images.
const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
const AVATAR_UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    if (/^image\/(jpe?g|png|webp|gif|avif)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Format image non supporté'), false);
    }
  },
};

@ApiTags('users')
@ApiAuth()
@Controller('users')
export class UsersController {
  constructor(
    readonly usersService: UsersService,
    readonly verificationService: UserVerificationService,
  ) {}

  // ─── Profile ──────────────────────────────────────────────────────────────

  @Public()
  @Get(ID_PARAM)
  @Serialize(PublicUserEntity)
  async getOneUser(@Param('id') id: UUID) {
    const user = await this.usersService.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Get('me')
  @Serialize(UserEntity)
  async getMe(@GetUserId() id: UUID) {
    // JWT valide mais utilisateur disparu (compte supprimé) → 401, pas un
    // 200 vide : le front purge la session au lieu d'un état « connecté à vide ».
    const user = await this.usersService.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Post('avatar')
  @Serialize(MediaEntity)
  @UseInterceptors(FileInterceptor('avatar', AVATAR_UPLOAD_OPTIONS))
  avatar(@GetUserId() id: UUID, @UploadedFile() avatar: Express.Multer.File) {
    if (!avatar) throw new BadRequestException('Aucun fichier fourni');
    return this.usersService.createAvatar(id, avatar);
  }

  @ApiBadRequestResponse({ description: 'Code invalide ou expiré' })
  @Post('verify/email')
  @HttpCode(HttpStatus.NO_CONTENT)
  verifyEmail(@Query('token') token: string) {
    return this.verificationService.verifyEmailToken(token);
  }

  // Plafonné : sans throttle, poser un pendingEmail tiers puis boucler ce
  // renvoi permettait un mail-bombing depuis notre domaine + une inflation de
  // tokens. 3 renvois / 15 min suffisent à l'usage légitime.
  @Post('verify/email/resend')
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  resendVerification(@GetUserId() id: UUID) {
    return this.verificationService.sendEmailVerification(id);
  }

  // Mise à jour de SON propre compte : DTO restreint (pas de role=ADMIN,
  // pas de *VerifiedAt, pas de password/id/timestamps).
  /** Profil. Un changement d'email part en pendingEmail (double confirmation). */
  @ApiConflictResponse({
    description: 'Email ou téléphone déjà utilisé par un autre compte',
  })
  @Patch()
  @HttpCode(HttpStatus.NO_CONTENT)
  update(@GetUserId() id: UUID, @Body() data: UpdateProfileDto) {
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
  removeSavedAddress(
    @GetUserId() id: UUID,
    @Param('addressId') addressId: string,
  ) {
    return this.usersService.removeSavedAddress(id, addressId);
  }
}
