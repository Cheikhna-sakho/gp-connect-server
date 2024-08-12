import { Module } from '@nestjs/common';
import { MediasService } from './medias.service';
import { MediasController } from './medias.controller';
import { DatabaseModule } from 'src/database/database.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  providers: [MediasService],
  controllers: [MediasController],
  exports: [MediasService],
  imports: [DatabaseModule, CloudinaryModule],
})
export class MediasModule {}
