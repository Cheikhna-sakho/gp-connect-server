import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class PhoneService {
  private client: Twilio;

  constructor(private readonly config: ConfigService) {
    this.client = new Twilio(
      this.config.get('TWILIO_SID'),
      this.config.get('TWILIO_AUTH_TOKEN'),
    );
  }

  async sendPhoneVerification(phone: string, code: string) {
    if (this.config.get('NODE_ENV') === 'development') {
      console.log({ code });
      return;
    }
    return this.client.messages.create({
      from: this.config.get('TWILIO_FROM'),
      to: phone,
      body: `Votre code de vérification GPConnect est : ${code}`,
    });
  }
}
