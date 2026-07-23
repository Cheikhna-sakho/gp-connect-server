import { Body, Controller, Param, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import { UUID } from 'crypto';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { MessageAppointmentEntity } from 'src/messages/entities/message-appointment.entity';
import { AppointmentsService } from './appointments.service';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

@ApiTags('appointments')
@ApiAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /** Décision de la contrepartie sur un RDV proposé dans le chat (jamais l'auteur). */
  @Patch(ID_PARAM)
  @ApiNotFoundResponse({ description: 'RDV inconnu' })
  @ApiBadRequestResponse({
    description: 'RDV plus PENDING (déjà décidé ou course perdue)',
  })
  @ApiForbiddenResponse({
    description:
      'Non-participant, ou auteur du RDV (on ne décide pas de sa propre proposition)',
  })
  @Serialize(MessageAppointmentEntity)
  updateStatus(
    @GetUserId() userId: UUID,
    @Param('id') id: UUID,
    @Body() data: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(id, userId, data);
  }
}
