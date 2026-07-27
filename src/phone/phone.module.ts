import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhoneService } from './phone.service';
import { SMS_SENDER } from './sms.port';
import { TwilioSmsSender } from './adapters/twilio.sms-sender';
import { ConsoleSmsSender } from './adapters/console.sms-sender';

// Seul endroit qui connaît les providers concrets : en développement les SMS
// sont loggés (Twilio n'est même pas instancié), sinon Twilio.
@Module({
  providers: [
    {
      provide: SMS_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get('NODE_ENV') === 'development') {
          new Logger('PhoneModule').log('SMS: console (dev)');
          return new ConsoleSmsSender();
        }
        new Logger('PhoneModule').log('SMS: Twilio');
        return new TwilioSmsSender({
          sid: config.get<string>('TWILIO_SID') ?? '',
          authToken: config.get<string>('TWILIO_AUTH_TOKEN') ?? '',
          from: config.get<string>('TWILIO_FROM') ?? '',
        });
      },
    },
    PhoneService,
  ],
  exports: [PhoneService],
})
export class PhoneModule {}
