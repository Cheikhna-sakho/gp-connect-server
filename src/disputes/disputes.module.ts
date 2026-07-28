import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { DatabaseModule } from 'src/database/database.module';
import { MissionsModule } from 'src/missions/missions.module';
import { EmailModule } from 'src/email/email.module';
import { DISPUTE_TRACKER } from './dispute-tracker.port';
import { GithubIssuesTracker } from './adapters/github-issues.tracker';
import { NoopDisputeTracker } from './adapters/noop.tracker';

// Seul endroit qui connaît le tracker concret : GitHub Issues si configuré
// et en production-like, sinon noop (même politique que les emails).
@Module({
  imports: [DatabaseModule, MissionsModule, EmailModule],
  providers: [
    {
      provide: DISPUTE_TRACKER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = config.get('NODE_ENV');
        const token = config.get<string>('GITHUB_ISSUES_TOKEN');
        const repo = config.get<string>('GITHUB_ISSUES_REPO'); // "owner/repo"
        const disabled =
          env === 'development' || env === 'test' || !token || !repo;
        if (disabled) {
          new Logger('DisputesModule').log(
            'Dispute tracker: noop (dev/test ou non configuré)',
          );
          return new NoopDisputeTracker();
        }
        new Logger('DisputesModule').log('Dispute tracker: GitHub Issues');
        return new GithubIssuesTracker({ token, repo });
      },
    },
    DisputesService,
  ],
  controllers: [DisputesController],
  exports: [DisputesService],
})
export class DisputesModule {}
