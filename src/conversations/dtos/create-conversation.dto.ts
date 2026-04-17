import { PickType } from '@nestjs/mapped-types';
import { Prisma } from '@prisma/client';
import { IsEmpty, IsOptional, IsUUID } from 'class-validator';
import { MissionDto } from 'src/missions/dtos/mission.dto';

export class CreateConversationDto
  extends PickType(MissionDto, ['packageIds'])
  implements Prisma.ConversationUncheckedCreateInput
{
  @IsUUID()
  advertisementId: string;
  @IsEmpty()
  shipperId: string;
  @IsEmpty()
  carrierId: string;

  @IsUUID()
  @IsOptional()
  missionId: string;
}
