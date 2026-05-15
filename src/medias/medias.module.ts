import { Module } from '@nestjs/common';
import { MediasService } from './medias.service';
import { DatabaseModule } from 'src/database/database.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  providers: [MediasService],
  exports: [MediasService],
  imports: [DatabaseModule, CloudinaryModule],
})
export class MediasModule {}
