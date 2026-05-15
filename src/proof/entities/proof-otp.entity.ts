import { Expose, Type } from 'class-transformer';

export class ProofOtpEntity {
  @Expose() code: string;

  @Type(() => Date)
  @Expose()
  expiresAt: Date;

  constructor(partial: Partial<ProofOtpEntity>) {
    Object.assign(this, partial);
  }
}
