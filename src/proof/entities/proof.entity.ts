import { $Enums, MissionProof } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

export class ProofEntity implements MissionProof {
  @Expose() id: string;
  @Expose() missionId: string;
  @Expose() type: $Enums.ProofType;
  @Expose() createdById: string;
  @Expose() verifiedById: string;
  @Expose() note: string;
  @Expose() otpExpiresAt: Date;
  @Expose() otpUsedAt: Date;
  @Expose() createdAt: Date;

  @Exclude() otpHash: string;

  constructor(partial: Partial<MissionProof>) {
    Object.assign(this, partial);
  }
}
