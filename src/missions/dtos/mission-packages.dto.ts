import { PickType } from '@nestjs/mapped-types';
import { MissionDto } from './mission.dto';

export class MissionPackagesDto extends PickType(MissionDto, ['packageIds']) {}
