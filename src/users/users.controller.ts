import {
  Controller,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';

@Controller('users')
export class UsersController {
  constructor(readonly usersService: UsersService) {}
  @Get()
  getUsers() {
    return this.usersService.findAll();
  }
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
  getMe(@GetUserId() id: string) {
    return this.usersService.findOne({ where: { id } });
  }

  @Patch()
  update(@GetUserId() id: string, @Body() data: Prisma.UserUpdateInput) {
    return this.usersService.updateById(id, data);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(ID_PARAM)
  updateUser(@Param('id') id: UUID, @Body() data: Prisma.UserUpdateInput) {
    return this.usersService.updateById(id, data);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(ID_PARAM)
  deleteUser(@Param('id') id: UUID) {
    return this.usersService.delete({ where: { id } });
  }
}
