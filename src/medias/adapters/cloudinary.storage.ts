import { MediaType } from '@prisma/client';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { StoragePort, StoredFile } from '../storage.port';

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

// Quirk Cloudinary : l'audio s'upload en resource_type "video".
const RESOURCE_TYPE: Record<MediaType, 'image' | 'video'> = {
  IMAGE: 'image',
  AUDIO: 'video',
  VIDEO: 'video',
};

export class CloudinaryStorage implements StoragePort {
  constructor(config: CloudinaryConfig) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
    });
  }

  async upload(
    file: Express.Multer.File,
    type: MediaType,
  ): Promise<StoredFile> {
    const uploaded = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: RESOURCE_TYPE[type] },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
    return { url: uploaded.secure_url, storageId: uploaded.public_id };
  }

  delete(storageId: string, type: MediaType) {
    return cloudinary.uploader.destroy(storageId, {
      resource_type: RESOURCE_TYPE[type],
    });
  }
}
