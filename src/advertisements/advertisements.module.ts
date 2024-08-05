import { Module } from '@nestjs/common';
import { AdvertisementsController } from './advertisements.controller';
import { AdvertisementsService } from './advertisements.service';
import { DatabaseModule } from 'src/database/database.module';
import { AddressesModule } from 'src/addresses/addresses.module';

@Module({
  controllers: [AdvertisementsController],
  providers: [AdvertisementsService],
  imports: [DatabaseModule, AddressesModule],
  exports: [AdvertisementsService],
})
export class AdvertisementsModule {}
