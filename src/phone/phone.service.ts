import { Inject, Injectable } from '@nestjs/common';
import { SMS_SENDER, SmsPort } from './sms.port';

@Injectable()
export class PhoneService {
  constructor(@Inject(SMS_SENDER) private readonly sms: SmsPort) {}

  async sendPhoneVerification(phone: string, code: string) {
    return this.sms.send({
      to: phone,
      body: `Votre code de vérification GPConnect est : ${code}`,
    });
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
    return this.sms.send({
      to: phone,
      body: `GPConnect — un colis arrive pour vous. À la remise, donnez ce code au transporteur : ${code} (valable jusqu'à ${time}).`,
    });
  }
}
