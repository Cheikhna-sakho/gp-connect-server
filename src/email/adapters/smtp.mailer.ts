import { createTransport, Transporter } from 'nodemailer';
import { MailerPort, OutgoingMail } from '../mailer.port';

// Envoi via SMTP classique (nodemailer). Inutilisable depuis Railway hors
// plan Pro (ports SMTP sortants bloqués) — sert en local ou chez un
// hébergeur qui ne filtre pas le SMTP.
export class SmtpMailer implements MailerPort {
  private readonly transporter: Transporter;

  constructor(
    private readonly opts: {
      host: string;
      port: number;
      user: string;
      pass: string;
      from: string;
    },
  ) {
    this.transporter = createTransport({
      host: opts.host,
      port: opts.port,
      auth: { user: opts.user, pass: opts.pass },
    });
  }

  send(mail: OutgoingMail) {
    return this.transporter.sendMail({ from: this.opts.from, ...mail });
  }
}
