import { PartialType } from '@nestjs/mapped-types';
import { MissionDto } from './mission.dto';

export class MissionPartial extends PartialType(MissionDto) {}
