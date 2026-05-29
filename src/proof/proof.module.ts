import { Module } from '@nestjs/common';
import { ProofService } from './proof.service';
import { DatabaseModule } from 'src/database/database.module';
import { MediasModule } from 'src/medias/medias.module';

@Module({
  imports: [DatabaseModule, MediasModule],
  providers: [ProofService],
  exports: [ProofService],
})
export class ProofModule {}
