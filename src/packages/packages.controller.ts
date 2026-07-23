import { ApiTags } from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { UUID } from 'crypto';
import { CreatePackageDto, UpdatePackageDto } from './dtos/package.dto';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { PackageEntity } from './entities/package.entity';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { ForbiddenException } from '@nestjs/common';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const imageFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new BadRequestException(`File type not allowed: ${file.mimetype}`),
      false,
    );
  }
  cb(null, true);
};

@ApiTags('packages')
@ApiAuth()
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  @Serialize(PackageEntity)
  getAllByOwner(@GetUserId() ownerId: UUID) {
    return this.packagesService.findAllByUser(ownerId);
  }

  @Get(`by-mission/${SetIdParam('missionId')}`)
  @Serialize(PackageEntity)
  getByMission(
    @GetUserId() userId: UUID,
    @Param('missionId') missionId: string,
  ) {
    return this.packagesService.findByMission(missionId, userId);
  }

  @Get(ID_PARAM)
  @Serialize(PackageEntity)
  async getOne(@GetUserId() userId: UUID, @Param('id') id: UUID) {
    const pkg = await this.packagesService.findBy({ id });
    if (!pkg) throw new NotFoundException('Package not found');
    // Un colis n'est consultable que par son propriétaire ; les participants
    // d'une mission passent par GET /packages/by-mission/:missionId.
    if (pkg.ownerId !== userId) throw new ForbiddenException();
    return pkg;
  }

  @UseGuards(RolesGuard)
  @Roles('SHIPPER')
  @Post()
  create(@GetUserId() ownerId: UUID, @Body() data: CreatePackageDto) {
    data.ownerId = ownerId;
    return this.packagesService.create(data);
  }

  @UseGuards(RolesGuard)
  @Roles('SHIPPER')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  @Post('full')
  createWithImages(
    @UploadedFiles() images: Express.Multer.File[] = [],
    @GetUserId() ownerId: UUID,
    @Body() data: CreatePackageDto,
  ) {
    data.ownerId = ownerId;
    return this.packagesService.createWithImages({ ...data, images });
  }

  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  @Post(`${ID_PARAM}/images`)
  async createImages(
    @GetUserId() userId: UUID,
    @Param('id') id: UUID,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    const pkg = await this.packagesService.findBy({ id });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.ownerId !== userId) throw new ForbiddenException();
    return this.packagesService.createImage(id, images);
  }

  @Patch(ID_PARAM)
  async update(
    @GetUserId() ownerId: UUID,
    @Param('id') id: UUID,
    @Body() data: UpdatePackageDto,
  ) {
    const pkg = await this.packagesService.findBy({ id });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.ownerId !== ownerId) throw new ForbiddenException();
    // Un colis engagé dans une mission est figé : éditer le poids/nom
    // désynchroniserait les termes négociés et la capacité de l'annonce
    // (miroir de la règle du delete).
    if (pkg.mission?.length) {
      throw new BadRequestException(
        'Cannot edit a package linked to a mission',
      );
    }
    return this.packagesService.update(id, data);
  }

  @Delete(ID_PARAM)
  delete(@GetUserId() ownerId: UUID, @Param('id') id: UUID) {
    return this.packagesService.delete(id, ownerId);
  }
}
