import { Module } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { DatabaseModule } from 'src/database/database.module';
import { AddressesController } from './addresses.controller';

@Module({
  providers: [AddressesService],
  exports: [AddressesService],
  imports: [DatabaseModule],
  controllers: [AddressesController],
})
export class AddressesModule {}
