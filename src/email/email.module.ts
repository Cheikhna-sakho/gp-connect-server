import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { MAILER } from './mailer.port';
import { MailgunApiMailer } from './adapters/mailgun-api.mailer';
import { SmtpMailer } from './adapters/smtp.mailer';

// Seul endroit qui connaît les providers concrets : MAILGUN_API_KEY présent
// → API HTTP Mailgun (fonctionne sur tous les plans Railway), sinon SMTP.
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const from = config.get<string>('MAIL_FROM') ?? '';
        const apiKey = config.get<string>('MAILGUN_API_KEY');
        if (apiKey) {
          new Logger('EmailModule').log('Mailer: Mailgun HTTP API');
          return new MailgunApiMailer({
            apiKey,
            domain: config.get<string>('MAILGUN_DOMAIN') ?? '',
            from,
            baseUrl: config.get<string>('MAILGUN_API_BASE'),
          });
        }
        new Logger('EmailModule').log('Mailer: SMTP');
        return new SmtpMailer({
          host: config.get<string>('MAIL_HOST') ?? '',
          port: config.get<number>('MAIL_PORT') ?? 587,
          user: config.get<string>('MAIL_USER') ?? '',
          pass: config.get<string>('MAIL_PASS') ?? '',
          from,
        });
      },
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
