import { Expose, Type } from 'class-transformer';

export class ProofOtpEntity {
  @Expose() code: string;

  @Type(() => Date)
  @Expose()
  expiresAt: Date;

  /** true si le code a aussi été envoyé par SMS au destinataire */
  @Expose() sentToRecipient?: boolean;

  constructor(partial: Partial<ProofOtpEntity>) {
    Object.assign(this, partial);
  }
}
