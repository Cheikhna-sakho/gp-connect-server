import { Logger } from '@nestjs/common';
import { OutgoingSms, SmsPort } from '../sms.port';

/** Adapter de dev : aucun SMS ne part, le contenu est loggé. */
export class ConsoleSmsSender implements SmsPort {
  private readonly logger = new Logger('SMS');

  async send({ to, body }: OutgoingSms) {
    this.logger.log(`→ ${to} : ${body}`);
  }
}
