import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { UUID } from 'crypto';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { TransactionEntity } from './entities/transaction.entity';
import { UpdateTransactionDto } from './dtos/update-transaction.dto';

@ApiTags('transactions')
@ApiAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get(`mission/${SetIdParam('missionId')}`)
  @Serialize(TransactionEntity)
  getByMission(
    @GetUserId() userId: UUID,
    @Param('missionId') missionId: string,
  ) {
    return this.transactionsService.findByMission(missionId, userId);
  }

  @ApiForbiddenResponse({
    description: "Seul l'expéditeur (payeur) peut changer le moyen de paiement",
  })
  @ApiBadRequestResponse({ description: 'Transaction non PENDING' })
  @Patch(ID_PARAM)
  @Serialize(TransactionEntity)
  update(
    @GetUserId() userId: UUID,
    @Param('id') id: string,
    @Body() data: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, userId, data);
  }
}
