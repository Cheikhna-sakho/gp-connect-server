import { $Enums, Prisma } from '@prisma/client';

export class ProofDto implements Prisma.MissionProofUncheckedCreateInput {
  missionId: string;
  type: $Enums.ProofType;
  createdById: string;
  verifiedById: string;
  note?: string;
  //   images?: Prisma.MissionProofImageUncheckedCreateNestedManyWithoutProofInput;
}
