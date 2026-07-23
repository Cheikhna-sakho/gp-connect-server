import { IsIn } from 'class-validator';

// Seules issues possibles pour la contrepartie — un RDV ne « redevient »
// jamais PENDING (re-proposer = nouveau message APPOINTMENT).
export class UpdateAppointmentStatusDto {
  @IsIn(['ACCEPTED', 'REJECTED'])
  status: 'ACCEPTED' | 'REJECTED';
}
