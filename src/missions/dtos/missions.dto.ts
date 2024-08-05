import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreateMissionDto implements Prisma.MissionUncheckedCreateInput {
  @IsOptional()
  initiatorId: string;
  @IsNotEmpty()
  advertisementId: string;
  @IsNotEmpty()
  packageId: string;
}
// export class UpdateMissionDto implements Prisma.MissionUpdateInput {}
