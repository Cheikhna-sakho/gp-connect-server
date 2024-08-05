import { Module } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { MissionsController } from './missions.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  providers: [MissionsService],
  controllers: [MissionsController],
  imports: [DatabaseModule],
})
export class MissionsModule {}
