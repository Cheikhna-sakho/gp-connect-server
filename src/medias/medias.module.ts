import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediasService } from './medias.service';
import { DatabaseModule } from 'src/database/database.module';
import { FILE_STORAGE } from './storage.port';
import { CloudinaryStorage } from './adapters/cloudinary.storage';

// Seul endroit qui connaît le provider de stockage concret.
@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        new Logger('MediasModule').log('Storage: Cloudinary');
        return new CloudinaryStorage({
          cloudName: config.get<string>('CLOUDINARY_NAME') ?? '',
          apiKey: config.get<string>('CLOUDINARY_API_KEY') ?? '',
          apiSecret: config.get<string>('CLOUDINARY_API_SECRET') ?? '',
        });
      },
    },
    MediasService,
  ],
  exports: [MediasService],
  imports: [DatabaseModule],
})
export class MediasModule {}
