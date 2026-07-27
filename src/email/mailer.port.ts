// Port d'envoi d'email : le domaine (EmailService) ne dépend que de ce
// contrat. Le provider concret (Mailgun API, SMTP, demain Resend/SES…) est
// un adapter branché dans EmailModule — en changer ne touche aucun service.
export const MAILER = Symbol('MAILER');

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
}

export interface MailerPort {
  send(mail: OutgoingMail): Promise<unknown>;
}
