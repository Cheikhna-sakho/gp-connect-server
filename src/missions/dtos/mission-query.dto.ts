import { IsEnum } from 'class-validator';
import { MissionPartial } from './mission-partial.dto';

export class MissionQuery extends MissionPartial {
  @IsEnum(['initiator', 'acceptor'])
  userRole?: 'initiator' | 'acceptor';
}
