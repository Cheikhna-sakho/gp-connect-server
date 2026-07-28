import { Inject, Injectable } from '@nestjs/common';
import { MediaType, Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { FILE_STORAGE, StoragePort } from './storage.port';

@Injectable()
export class MediasService {
  private medias: DatabaseService['media'];
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(FILE_STORAGE) private readonly storage: StoragePort,
  ) {
    this.medias = this.databaseService.media;
  }

  private extractFileMetadata(file: Express.Multer.File) {
    return JSON.stringify({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  private async create(file: Express.Multer.File, type: MediaType) {
    const uploaded = await this.storage.upload(file, type);
    return this.medias.create({
      data: {
        url: uploaded.url,
        publicId: uploaded.storageId,
        type,
        metadata: this.extractFileMetadata(file),
      },
    });
  }

  async createImage(file: Express.Multer.File) {
    return this.create(file, MediaType.IMAGE);
  }

  async createManyImages(files: Express.Multer.File[]) {
    return Promise.all(files.map((f) => this.createImage(f)));
  }

  async createAudio(file: Express.Multer.File) {
    return this.create(file, MediaType.AUDIO);
  }

  async createVideo(file: Express.Multer.File) {
    return this.create(file, MediaType.VIDEO);
  }

  async createManyVideos(files: Express.Multer.File[]) {
    return Promise.all(files.map((f) => this.createVideo(f)));
  }

  async createByMimetype(file: Express.Multer.File) {
    if (file.mimetype.startsWith('audio/')) return this.createAudio(file);
    if (file.mimetype.startsWith('video/')) return this.createVideo(file);
    return this.createImage(file);
  }

  async find(where: Prisma.MediaWhereInput) {
    return this.medias.findMany({ where });
  }

  async findOne(where: Prisma.MediaWhereUniqueInput) {
    return this.medias.findUnique({ where });
  }

  async delete(where: Prisma.MediaWhereUniqueInput) {
    const media = await this.medias.findUnique({
      where,
      select: { publicId: true, type: true },
    });
    if (media?.publicId) {
      await this.storage.delete(media.publicId, media.type);
    }
    return this.medias.delete({ where });
  }
}
