import { $Enums, MessageAppointment } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

export class MessageAppointmentEntity implements MessageAppointment {
  @Expose() id: string;

  @Expose() type: $Enums.AppointmentType;

  @Type(() => Date)
  @Expose()
  scheduledAt: Date;

  @Expose() status: $Enums.MessageAppointmentStatus;

  @Type(() => Date)
  createdAt: Date;

  @Type(() => Date)
  updatedAt: Date;

  constructor(partial: Partial<MessageAppointmentEntity>) {
    Object.assign(this, partial);
  }
}
