import { PickType } from '@nestjs/swagger';
import { MissionDto } from './mission.dto';

export class MissionPackagesDto extends PickType(MissionDto, ['packageIds']) {}
