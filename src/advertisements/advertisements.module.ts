import { Module } from '@nestjs/common';
import { AdvertisementsController } from './advertisements.controller';
import { AdvertisementsService } from './advertisements.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [AdvertisementsController],
  providers: [AdvertisementsService],
  imports: [DatabaseModule],
})
export class AdvertisementsModule {}
