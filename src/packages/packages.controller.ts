import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { UUID } from 'crypto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthRequest } from 'src/common/types/request.type';
import { CreatePackageDto } from './dtos/package.dto';
import { ROUTE_UUID_REGEX } from 'src/common/constants/route.util.const';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get()
  getAll() {
    return this.packagesService.findAll();
  }
  @Get('user')
  getUserPackages(@Request() req: AuthRequest) {
    const { id: ownerId } = req.user;
    return this.packagesService.find({ where: { ownerId } });
  }
  @Public()
  @Get(`:id(${ROUTE_UUID_REGEX})`)
  getOne(@Param('id') id: UUID) {
    const parcel = this.packagesService.findBy({ id });
    if (!parcel) {
      throw new NotFoundException('Package not found');
    }
    return parcel;
  }
  @Get('mine')
  getMine(@Request() req: AuthRequest) {
    const { id: ownerId } = req.user;
    return this.packagesService.find({ where: { ownerId } });
  }
  @Post()
  @UsePipes(new ValidationPipe())
  create(@Request() req: AuthRequest, @Body() data: CreatePackageDto) {
    const { id: ownerId } = req.user;
    data.ownerId = ownerId;

    return this.packagesService.create(data);
  }
  @Post(`:id(${ROUTE_UUID_REGEX})/images`)
  createImages(@Request() req: AuthRequest, @Body() data: any) {
    const { id: ownerId } = req.user;
    return this.packagesService.createImage(data);
  }
  @Patch(`:id(${ROUTE_UUID_REGEX})`)
  update(
    @Request() req: AuthRequest,
    @Param('id') id: UUID,
    @Body() data: any,
  ) {
    const { id: ownerId } = req.user;
    return this.packagesService.updateWhere({ where: { id, ownerId }, data });
  }
  @Delete(`:id(${ROUTE_UUID_REGEX})`)
  delete(@Request() req: AuthRequest, @Param('id') id: UUID) {
    const { id: ownerId } = req.user;
    return this.packagesService.delete({ where: { id, ownerId } });
  }
}
