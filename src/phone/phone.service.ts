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
    return this.sendSms(
      phone,
      `Votre code de vérification GPConnect est : ${code}`,
    );
  }

  /**
   * Code de livraison envoyé au destinataire (qui n'a pas de compte) :
   * il le communique au transporteur lors de la remise du colis.
   */
  async sendDeliveryCode(phone: string, code: string, expiresAt: Date) {
    const time = expiresAt.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return this.sendSms(
      phone,
      `GPConnect — un colis arrive pour vous. À la remise, donnez ce code au transporteur : ${code} (valable jusqu'à ${time}).`,
    );
  }

  private async sendSms(phone: string, body: string) {
    if (this.config.get('NODE_ENV') === 'development') {
      console.log({ to: phone, body });
      return;
    }
    return this.client.messages.create({
      from: this.config.get('TWILIO_FROM'),
      to: phone,
      body,
    });
  }
}
