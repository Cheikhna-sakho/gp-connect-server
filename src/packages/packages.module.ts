import { Module } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { DatabaseModule } from 'src/database/database.module';
import { MediasModule } from 'src/medias/medias.module';

@Module({
  imports: [DatabaseModule, MediasModule],
  controllers: [PackagesController],
  providers: [PackagesService],
})
export class PackagesModule {}
