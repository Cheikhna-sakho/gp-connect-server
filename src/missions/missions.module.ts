import { Module } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { MissionsController } from './missions.controller';
import { DatabaseModule } from 'src/database/database.module';
import { ProofModule } from 'src/proof/proof.module';
import { OffersModule } from 'src/offers/offers.module';
import { PhoneModule } from 'src/phone/phone.module';

@Module({
  providers: [MissionsService],
  controllers: [MissionsController],
  imports: [DatabaseModule, ProofModule, OffersModule, PhoneModule],
})
export class MissionsModule {}
