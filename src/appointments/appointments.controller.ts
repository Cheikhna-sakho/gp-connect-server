import { Body, Controller, Param, Patch } from '@nestjs/common';
import { UUID } from 'crypto';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { MessageAppointmentEntity } from 'src/messages/entities/message-appointment.entity';
import { AppointmentsService } from './appointments.service';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Patch(ID_PARAM)
  @Serialize(MessageAppointmentEntity)
  updateStatus(
    @GetUserId() userId: UUID,
    @Param('id') id: UUID,
    @Body() data: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(id, userId, data);
  }
}
