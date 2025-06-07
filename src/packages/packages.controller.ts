import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
  // UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { UUID } from 'crypto';
// import { RolesGuard } from 'src/auth/guards/role.guard';
// import { Roles } from 'src/auth/decorators/role.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { CreatePackageDto } from './dtos/package.dto';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { PackageEntity } from './entities/package.entity';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}
  // @UseGuards(RolesGuard)
  // @Roles('ADMIN')
  @Get('/all')
  @Public()
  @Serialize(PackageEntity)
  getAll() {
    return this.packagesService.findAll();
  }
  @Get()
  @Serialize(PackageEntity)
  getAllByOwner(@GetUserId() ownerId: UUID) {
    console.log({ ownerId });
    return this.packagesService.findAllByUser(ownerId);
  }
  @Public()
  @Get(ID_PARAM)
  @Serialize(PackageEntity)
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
  // @Public()
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
    }),
  )
  @Post(`full`)
  async createWithImages(
    @UploadedFiles()
    images: Express.Multer.File[] = [],

    @GetUserId() ownerId: UUID,
    @Body() data: CreatePackageDto,
  ) {
    data.ownerId = ownerId;
    return this.packagesService.createWithImages({ ...data, images });
  }
  @Public()
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: memoryStorage(),
    }),
  )
  @Post(`${ID_PARAM}/images`)
  createImages(
    @Param('id') id: UUID,
    @UploadedFiles()
    images: Express.Multer.File[],
  ) {
    return this.packagesService.createImage(id, images);
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
