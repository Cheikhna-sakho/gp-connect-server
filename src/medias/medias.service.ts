import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { DatabaseService } from 'src/database/database.service';
import * as imageSize from 'image-size';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
@Injectable()
export class MediasService {
  private medias: DatabaseService['media'];
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    this.medias = this.databaseService.media;
  }
  private extractImageMetadata(file: Express.Multer.File) {
    const dimensions = imageSize.imageSize(file.buffer);
    return {
      width: dimensions.width,
      height: dimensions.height,
      mimeType: file.mimetype,
      sizeMB: file.size / (1 * 1000000),
    };
  }
  private extractVideoMetadata(file: Express.Multer.File): Promise<any> {
    console.log({ file, p: file.path });
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(file.path, (err, metadata) => {
        if (err) reject(err);
        else {
          resolve({
            format: metadata.format.format_name,
            duration: metadata.format.duration,
            sizeMB: file.size / (1 * 1000000),
            resolution: metadata.streams
              .filter((s) => s.codec_type === 'video')
              .map((s) => ({
                width: s.width,
                height: s.height,
              }))[0],
          });
        }
      });
    });
  }
  private extractVocalMetadata(file: Express.Multer.File): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(file.path, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            format: metadata.format.format_name,
            duration: metadata.format.duration,
            sizeMB: file.size / (1 * 1000000),
            codec: metadata.streams.find((s) => s.codec_type === 'audio')
              ?.codec_name,
            sampleRate: metadata.streams.find((s) => s.codec_type === 'audio')
              ?.sample_rate,
            channels: metadata.streams.find((s) => s.codec_type === 'audio')
              ?.channels,
            bitrate: metadata.format.bit_rate,
          });
        }
      });
    });
  }

  async createImage(data: Express.Multer.File) {
    const image = await this.cloudinaryService.uploadFile(data);
    const metadata = this.extractImageMetadata(data);
    console.log({ metadata });
    return this.medias.create({
      data: { url: image.url, type: 'image', metadata },
    });
  }
  async createManyImages(data: Express.Multer.File[]) {
    return Promise.all(data.map((image) => this.createImage(image)));
  }
  async createVideo(data: Express.Multer.File) {
    // const video = await this.cloudinaryService.uploadFile(data);
    const metadata = await this.extractVideoMetadata(data);
    fs.unlinkSync(data.path);
    console.log({ metadata });
    return 'yes';
    // return this.medias.create({
    //   data: { url: video.url, type: 'video', metadata },
    // });
  }
  async createManyVideos(data: Express.Multer.File[]) {
    return Promise.all(data.map((video) => this.createVideo(video)));
  }
  async createAudio(data: Express.Multer.File) {
    const vocal = await this.cloudinaryService.uploadFile(data);
    const metadata = await this.extractVocalMetadata(data);
    fs.unlinkSync(data.path);
    return this.medias.create({
      data: { url: vocal.url, type: 'audio', metadata },
    });
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
