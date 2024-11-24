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
    return this.packages.findFirst({ where });
  }
  async find({ where }: Find) {
    return this.packages.findMany({ where });
  }
  async findOne({ where }: FindOne) {
    return this.packages.findFirst({ where });
  }
  async findAll() {
    return this.packages.findMany();
  }
  async findAllByUser(ownerId: string) {
    return this.packages.findMany({ where: { ownerId } });
  }
  async create(data: CreatePackageDto) {
    const { images, ownerId, ...rest } = data;
    let medias = {} as Prisma.PackageMediaCreateNestedManyWithoutPackageInput;
    if (images) {
      const imagesData = await this.mediasService.createManyImages(images);
      medias = {
        createMany: { data: imagesData.map(({ id }) => ({ mediaId: id })) },
      };
    }
    return this.packages.create({
      data: { ...rest, ownerId, medias },
    });
  }
  createImage(data: Express.Multer.File) {
    return this.mediasService.createImage(data);
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
