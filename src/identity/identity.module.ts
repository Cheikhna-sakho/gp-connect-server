import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { DatabaseModule } from 'src/database/database.module';
import { IDENTITY_VERIFIER } from './identity-verifier.port';
import { StripeIdentityVerifier } from './adapters/stripe-identity.verifier';

// Seul endroit qui connaît le provider de vérification d'identité concret.
@Module({
  imports: [DatabaseModule],
  controllers: [IdentityController],
  providers: [
    {
      provide: IDENTITY_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        new Logger('IdentityModule').log('Identity: Stripe Identity');
        return new StripeIdentityVerifier({
          secretKey: config.get<string>('STRIPE_SECRET_KEY') ?? '',
          webhookSecret: config.get<string>('STRIPE_WEBHOOK_SECRET_IDENTITY'),
          returnUrl: config.get<string>('STRIPE_IDENTITY_RETURN_URL'),
        });
      },
    },
    IdentityService,
  ],
})
export class IdentityModule {}
