// Port d'envoi de SMS : le domaine (PhoneService) ne dépend que de ce
// contrat. Le provider concret (Twilio, demain Vonage/OVH…) est un adapter
// branché dans PhoneModule — en changer ne touche aucun service.
export const SMS_SENDER = Symbol('SMS_SENDER');

export interface OutgoingSms {
  to: string;
  body: string;
}

export interface SmsPort {
  send(sms: OutgoingSms): Promise<unknown>;
}
