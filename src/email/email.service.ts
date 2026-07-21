import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly config: ConfigService,
  ) {}

  // Aucun email réel hors production-like : en dev on logge, en test (jest
  // e2e) on n'envoie rien non plus — le parcours login y est joué pour de vrai.
  private get isMailDisabled() {
    const env = this.config.get('NODE_ENV');
    return env === 'development' || env === 'test';
  }

  async sendEmailVerification(to: string, token: string) {
    const url = `${process.env.FRONTEND_URL}/verify/email?token=${token}`;
    if (this.isMailDisabled) {
      console.log({ url });
      return url;
    }
    const html = `
      <div style="font-family:Arial, sans-serif;font-size:16px;color:#333;">
        <h2>Confirmez votre adresse email</h2>
        <p>Bonjour,</p>
        <p>Cliquez sur le bouton ci-dessous pour vérifier votre adresse email :</p>
        
        <a href="${url}" 
           style="display:inline-block;margin:20px 0;padding:10px 18px;
                  background:#1a73e8;color:white;text-decoration:none;
                  border-radius:6px;">
          Vérifier mon email
        </a>

        <p>Ou copiez-collez le lien dans votre navigateur :</p>
        <p>${url}</p>

        <p>— L’équipe GPConnect</p>
      </div>
    `;

    return this.mailerService.sendMail({
      to,
      subject: 'Confirmez votre email',
      html,
    });
  }
  sendOfferAccepted(
    to: string,
    data: { firstName?: string | null; price: number; missionId: string },
  ) {
    const url = `${process.env.FRONTEND_URL}/missions?id=${data.missionId}`;
    if (this.isMailDisabled) {
      console.log({ offerAccepted: to, url });
      return url;
    }
    const html = `
      <div style="font-family:Arial, sans-serif;font-size:16px;color:#333;">
        <p>Bonjour${data.firstName ? ` ${data.firstName}` : ''},</p>
        <p>Bonne nouvelle : votre offre à <strong>${data.price} €</strong> a été acceptée.
        La mission est prête — retrouvez les prochaines étapes (colis, codes de
        remise) sur votre espace GPConnect.</p>

        <a href="${url}"
           style="display:inline-block;margin:20px 0;padding:10px 18px;
                  background:#1a73e8;color:white;text-decoration:none;
                  border-radius:6px;">
          Voir la mission
        </a>

        <p>Ou copiez-collez le lien dans votre navigateur :</p>
        <p>${url}</p>

        <p>— L’équipe GPConnect</p>
      </div>
    `;
    return this.mailerService.sendMail({
      to,
      subject: 'Votre offre a été acceptée 🎉',
      html,
    });
  }

  sendEmailOpt(to: string, token: string) {
    const html = `
      <div>
        Votre mot de passe est : <strong>${token} </strong>
      <div>
    `;
    if (this.isMailDisabled) {
      console.log({ token });
      return;
    }
    return this.mailerService.sendMail({
      to,
      subject: 'Mot de passe a usage unique',
      html,
    });
  }
}
