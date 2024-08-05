import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class MediasService {
  private medias: DatabaseService['media'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    this.medias = this.databaseService.media;
  }
  async createImage(data: Express.Multer.File) {
    // const this.cloudinaryService.uploadFile(data);
    const image = await this.cloudinaryService.uploadFile(data);
    return this.medias.create({ data: { url: image.url, type: 'image' } });
  }
  async createManyImages(data: Express.Multer.File[]) {
    const images = await Promise.all(
      data.map((image) => this.createImage(image)),
    );
    return images;
  }
  async createVideo(data: Express.Multer.File) {
    const video = await this.cloudinaryService.uploadFile(data);
    return this.medias.create({ data: { url: video.url, type: 'video' } });
  }
  async createManyVideos(data: Express.Multer.File[]) {
    const videos = await Promise.all(
      data.map((video) => this.createVideo(video)),
    );
    return videos;
  }
  async find(where: Prisma.MediaWhereInput) {
    return this.medias.findMany({ where });
  }
  async findOne(where: Prisma.MediaWhereUniqueInput) {
    return this.medias.findUnique({ where });
  }
  async delete(where: Prisma.MediaWhereUniqueInput) {
    return this.medias.delete({ where });
  }
}
