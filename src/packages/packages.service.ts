import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreatePackageDto, UpdatePackageDto } from './dtos/package.dto';
import { MediasService } from 'src/medias/medias.service';

const DEFAULT_INCLUDE = {
  images: { select: { media: true } },
  mission: true,
} as const;

@Injectable()
export class PackagesService {
  private packages: DatabaseService['package'];
  private packageMedias: DatabaseService['packageMedia'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mediasService: MediasService,
  ) {
    this.packages = this.databaseService.package;
    this.packageMedias = this.databaseService.packageMedia;
  }

  async findBy(where: Prisma.PackageWhereUniqueInput) {
    return this.packages.findFirst({
      where,
      include: { ...DEFAULT_INCLUDE, mission: true },
    });
  }

  async findOne(where: Prisma.PackageWhereInput) {
    return this.packages.findFirst({ where, include: DEFAULT_INCLUDE });
  }

  async findAll() {
    return this.packages.findMany({ include: DEFAULT_INCLUDE });
  }

  async findAllByUser(ownerId: string) {
    return this.packages.findMany({
      where: { ownerId },
      include: DEFAULT_INCLUDE,
    });
  }

  async findByMission(missionId: string, userId: string) {
    const mission = await this.databaseService.mission.findFirst({
      where: {
        id: missionId,
        OR: [{ shipperId: userId }, { carrierId: userId }],
      },
      select: { id: true },
    });
    if (!mission) throw new BadRequestException('Mission not found or access denied');
    return this.packages.findMany({
      where: { mission: { some: { missionId } } },
      include: DEFAULT_INCLUDE,
    });
  }

  async create(data: CreatePackageDto) {
    const { ownerId, ...rest } = data;
    return this.packages.create({ data: { ...rest, ownerId } });
  }

  async createWithImages(
    data: CreatePackageDto & { images?: Express.Multer.File[] },
  ) {
    const { ownerId, images, ...rest } = data;
    const medias = await this.mediasService.createManyImages(images ?? []);
    try {
      return await this.packages.create({
        data: {
          ...rest,
          owner: { connect: { id: ownerId } },
          images: {
            createMany: { data: medias.map(({ id }) => ({ mediaId: id })) },
          },
        },
      });
    } catch (e) {
      // Rollback Cloudinary uploads if DB create fails
      await Promise.allSettled(medias.map((m) => this.mediasService.delete({ id: m.id })));
      throw e;
    }
  }

  async createImage(packageId: string, files: Express.Multer.File[]) {
    const images = await this.mediasService.createManyImages(files);
    await this.packageMedias.createMany({
      data: images.map(({ id: mediaId }) => ({ packageId, mediaId })),
    });
    return images;
  }

  async update(id: string, data: UpdatePackageDto) {
    return this.packages.update({ where: { id }, data });
  }

  async delete(id: string, ownerId: string) {
    const pkg = await this.packages.findFirst({
      where: { id, ownerId },
      include: { images: { include: { media: true } }, mission: true },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.mission?.length) {
      throw new BadRequestException('Cannot delete a package linked to a mission');
    }

    // Delete Cloudinary files + Media DB records
    // PackageMedia join records cascade when Media is deleted (onDelete: Cascade)
    await Promise.allSettled(
      pkg.images.map(({ media }) => this.mediasService.delete({ id: media.id })),
    );

    return this.packages.delete({ where: { id } });
  }
}
