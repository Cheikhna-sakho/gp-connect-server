import { $Enums, Prisma } from '@prisma/client';
import { IsDateString, IsEmpty, IsEnum } from 'class-validator';

export class CreateAppointmentDto
  implements Prisma.MessageAppointmentUncheckedCreateInput
{
  @IsEmpty()
  id: string;

  // Dépôt du colis (PICKUP) ou remise au destinataire (DELIVERY)
  @IsEnum($Enums.AppointmentType)
  type: $Enums.AppointmentType;

  // ISO 8601 — stocké en UTC, affiché en local côté client
  @IsDateString()
  scheduledAt: string;

  // Comme les offres : un RDV naît PENDING (défaut schéma), le passage
  // ACCEPTED/REJECTED est piloté par AppointmentsService (contrepartie).
  @IsEmpty()
  status?: $Enums.MessageAppointmentStatus;
}
