import { Expose, Type } from 'class-transformer';

export class ProofOtpEntity {
  // Absent quand le code part au destinataire (livraison) : il n'est alors PAS
  // exposé à l'expéditeur, pour empêcher l'auto-confirmation de livraison.
  @Expose() code?: string;

  @Type(() => Date)
  @Expose()
  expiresAt: Date;

  /** true si le code a aussi été envoyé par SMS au destinataire */
  @Expose() sentToRecipient?: boolean;

  constructor(partial: Partial<ProofOtpEntity>) {
    Object.assign(this, partial);
  }
}
