import {
  Controller,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthRequest } from 'src/common/types/request.type';
import { ROUTE_UUID_REGEX } from 'src/common/constants/route.util.const';

@Controller('users')
export class UsersController {
  constructor(readonly usersService: UsersService) {}
  @Get()
  getUsers() {
    return this.usersService.findAll();
  }
  @Public()
  @Get(`:id(${ROUTE_UUID_REGEX})`)
  getOneUser(@Param('id') id: UUID) {
    const user = this.usersService.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
  @Get('me')
  getMe(@Request() req: AuthRequest) {
    const { id } = req.user;
    return this.usersService.findOne({ where: { id } });
  }
  /*
  |--------------------------------------------------------------------------
  // #region User's joined resources
  |--------------------------------------------------------------------------
  */
  @Get('conversations')
  async getConversations(@Request() req: AuthRequest) {
    console.log(req.user, 'first');
    const { id } = req.user;
    const { conversations } = await this.usersService.findConversations(id);
    return conversations;
  }
  @Get('packages')
  async getPackages(@Request() req: AuthRequest) {
    const { id } = req.user;
    const { packages } = await this.usersService.findPackages(id);
    return packages;
  }
  @Get('advertisements')
  getAdvertisements(@Request() req: AuthRequest) {
    const { id } = req.user;
    return this.usersService.findAdvertisements(id);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GP')
  @Get('missions')
  async getMissions(@Request() req: AuthRequest) {
    const { id } = req.user;
    const { missions } = await this.usersService.findMissions(id);
    return missions;
  }
  /*
  |--------------------------------------------------------------------------
  // #endregion User's joined resources
  |--------------------------------------------------------------------------
  */

  @Patch()
  update(@Request() req: AuthRequest, @Body() data: Prisma.UserUpdateInput) {
    const { id } = req.user;
    return this.usersService.updateById(id, data);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(`:id(${ROUTE_UUID_REGEX})`)
  updateUser(@Param('id') id: UUID, @Body() data: Prisma.UserUpdateInput) {
    return this.usersService.updateById(id, data);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(`:id(${ROUTE_UUID_REGEX})`)
  deleteUser(@Param('id') id: UUID) {
    return this.usersService.delete({ where: { id } });
  }
}
