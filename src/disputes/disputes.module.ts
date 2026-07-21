import { Module } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { DatabaseModule } from 'src/database/database.module';
import { MissionsModule } from 'src/missions/missions.module';
import { GithubIssuesService } from './github-issues.service';

@Module({
  imports: [DatabaseModule, MissionsModule],
  providers: [DisputesService, GithubIssuesService],
  controllers: [DisputesController],
})
export class DisputesModule {}
