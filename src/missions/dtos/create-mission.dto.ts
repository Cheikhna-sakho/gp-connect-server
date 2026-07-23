import { PickType } from '@nestjs/swagger';
import { MissionDto } from './mission.dto';
import { Prisma } from '@prisma/client';

export class CreateMissionDto
  extends PickType(MissionDto, ['advertisementId', 'shipperId', 'packageIds'])
  implements Prisma.MissionUncheckedCreateInput {}
