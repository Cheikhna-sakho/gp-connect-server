import { Module } from '@nestjs/common';
import { ProofService } from './proof.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ProofService],
  exports: [ProofService],
})
export class ProofModule {}
