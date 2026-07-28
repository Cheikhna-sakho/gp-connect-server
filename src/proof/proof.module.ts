import { Module } from '@nestjs/common';
import { ProofService } from './proof.service';
import { DatabaseModule } from 'src/database/database.module';
import { MediasModule } from 'src/medias/medias.module';
import { PhoneModule } from 'src/phone/phone.module';

@Module({
  imports: [DatabaseModule, MediasModule, PhoneModule],
  providers: [ProofService],
  exports: [ProofService],
})
export class ProofModule {}
