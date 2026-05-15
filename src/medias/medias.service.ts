import { Injectable } from '@nestjs/common';
import { MediaType, Prisma } from '@prisma/client';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { DatabaseService } from 'src/database/database.service';

type CloudinaryResourceType = 'image' | 'video' | 'raw';

const CLOUDINARY_RESOURCE_TYPE: Record<MediaType, CloudinaryResourceType> = {
  IMAGE: 'image',
  AUDIO: 'video',
  VIDEO: 'video',
};

@Injectable()
export class MediasService {
  private medias: DatabaseService['media'];
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService,
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

  async createImage(file: Express.Multer.File) {
    const uploaded = await this.cloudinaryService.uploadFile(file, 'image');
    return this.medias.create({
      data: {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        type: MediaType.IMAGE,
        metadata: this.extractFileMetadata(file),
      },
    });
  }

  async createManyImages(files: Express.Multer.File[]) {
    return Promise.all(files.map((f) => this.createImage(f)));
  }

  async createAudio(file: Express.Multer.File) {
    const uploaded = await this.cloudinaryService.uploadFile(file, 'video');
    return this.medias.create({
      data: {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        type: MediaType.AUDIO,
        metadata: this.extractFileMetadata(file),
      },
    });
  }

  async createVideo(file: Express.Multer.File) {
    const uploaded = await this.cloudinaryService.uploadFile(file, 'video');
    return this.medias.create({
      data: {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        type: MediaType.VIDEO,
        metadata: this.extractFileMetadata(file),
      },
    });
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
      await this.cloudinaryService.deleteFile(
        media.publicId,
        CLOUDINARY_RESOURCE_TYPE[media.type],
      );
    }
    return this.medias.delete({ where });
  }
}
