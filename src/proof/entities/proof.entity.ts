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
  @Exclude() otpAttempts: number;

  @Expose()
  @Transform(
    ({ value }: { value?: ProofImageWithMedia[] }) =>
      // `?.` : couvre un lien orphelin / média supprimé (sinon 500 sur `.url`).
      value?.map((pi) => pi.image?.url).filter(Boolean) ?? [],
    // toPlainOnly : ce transform réduit `[{image:{url}}]` → `[url]`. Sans lui il
    // s'exécute AUSSI à la passe plainToInstance de la route, puis le
    // ClassSerializerInterceptor global le rejoue sur le `string[]` déjà réduit
    // (chaque élément est une string → `pi.image` undefined → `[]`, ou crash).
    // En le limitant à la conversion vers plain, il ne tourne qu'une fois.
    { toPlainOnly: true },
  )
  images: ProofImageWithMedia[];

  constructor(partial: Partial<MissionProof>) {
    Object.assign(this, partial);
  }
}
