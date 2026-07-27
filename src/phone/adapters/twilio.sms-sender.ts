import { Twilio } from 'twilio';
import { OutgoingSms, SmsPort } from '../sms.port';

type TwilioConfig = { sid: string; authToken: string; from: string };

export class TwilioSmsSender implements SmsPort {
  private readonly client: Twilio;

  constructor(private readonly config: TwilioConfig) {
    this.client = new Twilio(config.sid, config.authToken);
  }

  send({ to, body }: OutgoingSms) {
    return this.client.messages.create({ from: this.config.from, to, body });
  }
}
