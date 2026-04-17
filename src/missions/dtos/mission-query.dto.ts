import { MissionPartial } from './mission-partial.dto';
import { OmitType } from '@nestjs/mapped-types';

export class MissionQuery extends OmitType(MissionPartial, ['packageIds']) {}
