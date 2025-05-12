import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreatePackageDto } from './dtos/package.dto';
import { MediasService } from 'src/medias/medias.service';
type Find = { where: Prisma.PackageWhereInput };
type FindOne = { where: Prisma.PackageWhereInput };
type FindUnique = Prisma.PackageWhereUniqueInput;
type Update = {
  data: Prisma.PackageUpdateInput;
  where: Prisma.PackageWhereUniqueInput;
};
type UpdateBy = Prisma.PackageUpdateInput;

type Delete = { where: Prisma.PackageWhereUniqueInput };

const DEFAULT_INCLUDE = {
  images: { include: { media: true } },
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
  async findBy(where: FindUnique) {
    return this.packages.findFirst({ where, include: DEFAULT_INCLUDE });
  }
  async find({ where }: Find) {
    return this.packages.findMany({ where, include: DEFAULT_INCLUDE });
  }
  async findOne({ where }: FindOne) {
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
  async create(data: CreatePackageDto) {
    const { ownerId, ...rest } = data;

    return this.packages.create({
      data: { ...rest, ownerId },
    });
  }
  async createImage(packageId: string, data: Express.Multer.File[]) {
    const images = await this.mediasService.createManyVideos(data);
    // await this.packageMedias.createMany({
    //   data: images.map(({ id: mediaId }) => ({ packageId, mediaId })),
    // });
    return images;
  }
  async updateWhere({ data, where }: Update) {
    return this.packages.update({ where, data });
  }
  async updateById(id: string, data: UpdateBy) {
    return this.packages.update({ where: { id }, data });
  }
  async delete(where: Delete) {
    this.packages.delete(where);
  }
}
