import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { ProofModule } from 'src/proof/proof.module';

@Module({
  controllers: [OffersController],
  providers: [OffersService],
  imports: [ProofModule],
  exports: [OffersService],
})
export class OffersModule {}
