import { MailerPort, OutgoingMail } from '../mailer.port';

// Envoi via l'API HTTP Mailgun (pas SMTP : Railway bloque les ports SMTP
// sortants hors plan Pro). Classe volontairement sans décorateur Nest ni
// SDK Mailgun : fetch natif + form-urlencoded suffisent.
export class MailgunApiMailer implements MailerPort {
  constructor(
    private readonly opts: {
      apiKey: string;
      domain: string;
      from: string;
      // https://api.eu.mailgun.net pour un domaine créé en région EU.
      baseUrl?: string;
    },
  ) {}

  async send(mail: OutgoingMail) {
    const base = this.opts.baseUrl ?? 'https://api.mailgun.net';
    const res = await fetch(`${base}/v3/${this.opts.domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`api:${this.opts.apiKey}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        from: this.opts.from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
      }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Mailgun API ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }
}
