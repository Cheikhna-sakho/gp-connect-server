import { Expose } from 'class-transformer';

export class IdentitySessionEntity {
  @Expose() id: string;
  @Expose() url: string;
  @Expose() clientSecret: string;

  constructor(partial: Partial<IdentitySessionEntity>) {
    Object.assign(this, partial);
  }
}
