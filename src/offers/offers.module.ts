import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [OffersController],
  providers: [OffersService],
  imports: [DatabaseModule],
  exports: [OffersService],
})
export class OffersModule {}
