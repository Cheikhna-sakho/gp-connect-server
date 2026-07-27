import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAILER, MailerPort } from './mailer.port';

@Injectable()
export class EmailService {
  constructor(
    @Inject(MAILER) private readonly mailer: MailerPort,
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

    return this.mailer.send({
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
    return this.mailer.send({
      to,
      subject: 'Votre offre a été acceptée 🎉',
      html,
    });
  }

  private disputeReasonLabel(reason: string) {
    const labels: Record<string, string> = {
      missing: 'Colis manquant',
      damaged: 'Colis endommagé',
      late: 'Livraison en retard',
      fraud: 'Fraude suspectée',
      other: 'Autre problème',
    };
    return labels[reason] ?? reason;
  }

  sendDisputeOpened(
    to: string,
    data: { firstName?: string | null; missionId: string; reason: string },
  ) {
    const url = `${process.env.FRONTEND_URL}/missions?id=${data.missionId}`;
    if (this.isMailDisabled) {
      console.log({ disputeOpened: to, url });
      return url;
    }
    const html = `
      <div style="font-family:Arial, sans-serif;font-size:16px;color:#333;">
        <p>Bonjour${data.firstName ? ` ${data.firstName}` : ''},</p>
        <p>Un litige vient d'être ouvert sur l'une de vos missions
        (motif : <strong>${this.disputeReasonLabel(data.reason)}</strong>).</p>
        <p>Notre équipe examine la situation. Vous pouvez consulter le détail
        et suivre l'avancement depuis votre espace GPConnect.</p>

        <a href="${url}"
           style="display:inline-block;margin:20px 0;padding:10px 18px;
                  background:#1a73e8;color:white;text-decoration:none;
                  border-radius:6px;">
          Voir la mission
        </a>

        <p>— L’équipe GPConnect</p>
      </div>
    `;
    return this.mailer.send({
      to,
      subject: 'Un litige a été ouvert sur votre mission',
      html,
    });
  }

  sendDisputeResolved(
    to: string,
    data: {
      firstName?: string | null;
      missionId: string;
      resolution: string;
      missionOutcome: 'COMPLETED' | 'CANCELLED';
    },
  ) {
    const url = `${process.env.FRONTEND_URL}/missions?id=${data.missionId}`;
    if (this.isMailDisabled) {
      console.log({ disputeResolved: to, url });
      return url;
    }
    const outcomeLabel =
      data.missionOutcome === 'COMPLETED'
        ? 'la mission a été marquée comme terminée'
        : 'la mission a été annulée';
    const html = `
      <div style="font-family:Arial, sans-serif;font-size:16px;color:#333;">
        <p>Bonjour${data.firstName ? ` ${data.firstName}` : ''},</p>
        <p>Le litige sur votre mission a été résolu par notre équipe :
        ${outcomeLabel}.</p>
        <p style="padding:12px 16px;background:#f5f7fa;border-radius:8px;">
          ${data.resolution}
        </p>

        <a href="${url}"
           style="display:inline-block;margin:20px 0;padding:10px 18px;
                  background:#1a73e8;color:white;text-decoration:none;
                  border-radius:6px;">
          Voir la mission
        </a>

        <p>— L’équipe GPConnect</p>
      </div>
    `;
    return this.mailer.send({
      to,
      subject: 'Votre litige a été résolu',
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
    return this.mailer.send({
      to,
      subject: 'Mot de passe a usage unique',
      html,
    });
  }
}
