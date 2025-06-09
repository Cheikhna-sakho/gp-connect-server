import { PickType } from '@nestjs/mapped-types';
import { MissionDto } from './mission.dto';
import { IsNotEmpty } from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateMissionDto
  extends PickType(MissionDto, ['advertisementId', 'initiatorId'])
  implements Prisma.MissionUncheckedCreateInput
{
  @IsNotEmpty()
  packageId: string;
}
