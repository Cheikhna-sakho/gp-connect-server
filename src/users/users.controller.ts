import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';

@Controller('users')
export class UsersController {
  constructor(readonly usersService: UsersService) {}
  @Get()
  findUsers() {
    return this.usersService.findAll();
  }
  @Get(':id')
  findOneUser(@Param('id') id: UUID) {
    return this.usersService.findOne({ where: { id } });
  }
  @Post()
  createUser(@Body() body: Prisma.UserCreateInput) {
    return this.usersService.create({ data: body });
  }
  @Patch(':id')
  updateUser(@Param('id') id: UUID, @Body() data: Prisma.UserUpdateInput) {
    return this.usersService.updateById(id, data);
  }
  @Delete(':id')
  deleteUser(@Param('id') id: UUID) {
    return this.usersService.delete({ where: { id } });
  }
}
