import { PartialType } from '@nestjs/swagger';
import { MissionDto } from './mission.dto';

export class MissionPartial extends PartialType(MissionDto) {}
