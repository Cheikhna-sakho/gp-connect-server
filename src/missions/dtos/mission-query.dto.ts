import { OmitType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MissionPartial } from './mission-partial.dto';

export class MissionQuery extends OmitType(MissionPartial, ['packageIds']) {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
