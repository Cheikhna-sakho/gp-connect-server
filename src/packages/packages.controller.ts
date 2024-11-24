import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { UUID } from 'crypto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { CreatePackageDto } from './dtos/package.dto';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('/all')
  getAll() {
    return this.packagesService.findAll();
  }
  @Get()
  getAllByOwner(@GetUserId() ownerId: UUID) {
    return this.packagesService.findAllByUser(ownerId);
  }
  @Public()
  @Get(ID_PARAM)
  async getOne(@Param('id') id: UUID) {
    const parcel = await this.packagesService.findBy({ id });
    if (!parcel) {
      throw new NotFoundException('Package not found');
    }
    return parcel;
  }
  @Post()
  @UsePipes(new ValidationPipe())
  create(@GetUserId() ownerId: UUID, @Body() data: CreatePackageDto) {
    data.ownerId = ownerId;
    return this.packagesService.create(data);
  }
  @Post(`${ID_PARAM}/images`)
  createImages(@Body() data: any) {
    return this.packagesService.createImage(data);
  }
  @Patch(ID_PARAM)
  update(@GetUserId() ownerId: UUID, @Param('id') id: UUID, @Body() data: any) {
    return this.packagesService.updateWhere({ where: { id, ownerId }, data });
  }
  @Delete(ID_PARAM)
  delete(@GetUserId() ownerId: UUID, @Param('id') id: UUID) {
    return this.packagesService.delete({ where: { id, ownerId } });
  }
}
