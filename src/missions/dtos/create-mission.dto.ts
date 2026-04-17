import { PickType } from '@nestjs/mapped-types';
import { MissionDto } from './mission.dto';
import { Prisma } from '@prisma/client';

export class CreateMissionDto
  extends PickType(MissionDto, ['advertisementId', 'shipperId', 'packageIds'])
  implements Prisma.MissionUncheckedCreateInput {}
