import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryResponse } from './cloudinary-response';
import * as streamifier from 'streamifier';

type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto';

@Injectable()
export class CloudinaryService {
  uploadFile(
    file: Express.Multer.File,
    resourceType: CloudinaryResourceType = 'auto',
  ): Promise<CloudinaryResponse> {
    return new Promise<CloudinaryResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string, resourceType: CloudinaryResourceType = 'image') {
    return cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }
}
