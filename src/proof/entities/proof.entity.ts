import { $Enums, MissionProof, MissionProofImage, Media } from '@prisma/client';
import { Exclude, Expose, Transform } from 'class-transformer';

type ProofImageWithMedia = MissionProofImage & { image: Media };

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

  @Expose()
  @Transform(
    ({ value }: { value?: ProofImageWithMedia[] }) =>
      value?.map((pi) => pi.image.url) ?? [],
  )
  images: ProofImageWithMedia[];

  constructor(partial: Partial<MissionProof>) {
    Object.assign(this, partial);
  }
}
