import { $Enums, MissionProof } from '@prisma/client';
import { Expose } from 'class-transformer';

export class ProofEntity implements MissionProof {
  @Expose()
  id: string;
  @Expose()
  missionId: string;
  @Expose()
  type: $Enums.ProofType;
  @Expose()
  otpHash: string;
  @Expose()
  otpSalt: string;
  @Expose()
  otpExpiresAt: Date;
  @Expose()
  otpUsedAt: Date;
  @Expose()
  createdById: string;
  @Expose()
  verifiedById: string;
  @Expose()
  note: string;
  @Expose()
  createdAt: Date;
}
