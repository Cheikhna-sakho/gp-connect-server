import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseService } from 'src/database/database.service';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

/**
 * Statut des RDV proposés dans le chat (MessageAppointment) — même mécanique
 * que les offres : seule la CONTREPARTIE décide (jamais l'auteur), et le
 * verrou optimiste garantit qu'une seule décision écrit.
 */
@Injectable()
export class AppointmentsService {
  private appointments: DatabaseService['messageAppointment'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.appointments = this.databaseService.messageAppointment;
  }

  async updateStatus(
    id: string,
    userId: string,
    data: UpdateAppointmentStatusDto,
  ) {
    const appointment = await this.appointments.findUnique({
      where: { id },
      include: {
        message: {
          select: {
            authorId: true,
            conversationId: true,
            conversation: { select: { shipperId: true, carrierId: true } },
          },
        },
      },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.status !== 'PENDING') {
      throw new BadRequestException('This appointment is no longer pending');
    }

    const { shipperId, carrierId } = appointment.message.conversation;
    if (userId !== shipperId && userId !== carrierId) {
      throw new ForbiddenException();
    }
    if (appointment.message.authorId === userId) {
      throw new ForbiddenException(
        'Cannot change the status of your own appointment',
      );
    }

    // Verrou optimiste : deux décisions concurrentes (ou un double-clic) ne
    // peuvent pas écrire toutes deux — seule la première matche PENDING.
    const { count } = await this.appointments.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: data.status },
    });
    if (count === 0) {
      throw new BadRequestException('This appointment is no longer pending');
    }

    const updated = await this.appointments.findUnique({ where: { id } });
    this.eventEmitter.emit('appointment.updated', {
      appointment: updated,
      conversationId: appointment.message.conversationId,
    });
    return updated;
  }
}
