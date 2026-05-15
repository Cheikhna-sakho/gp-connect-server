import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { UpdateTransactionDto } from './dtos/update-transaction.dto';

@Injectable()
export class TransactionsService {
  private transactions: DatabaseService['transaction'];

  constructor(private readonly databaseService: DatabaseService) {
    this.transactions = this.databaseService.transaction;
  }

  async findByMission(missionId: string, userId: string) {
    const mission = await this.databaseService.mission.findFirst({
      where: {
        id: missionId,
        OR: [{ shipperId: userId }, { carrierId: userId }],
      },
      select: { id: true },
    });
    if (!mission) throw new ForbiddenException();

    const tx = await this.transactions.findUnique({ where: { missionId } });
    if (!tx) throw new NotFoundException('No transaction for this mission yet');
    return tx;
  }

  async update(id: string, userId: string, data: UpdateTransactionDto) {
    const tx = await this.transactions.findUnique({
      where: { id },
      include: {
        mission: { select: { shipperId: true, carrierId: true } },
      },
    });
    if (!tx) throw new NotFoundException();

    // Only the shipper pays — only they can change the payment method
    if (tx.mission.shipperId !== userId) {
      throw new ForbiddenException('Only the shipper can update the payment method');
    }
    if (tx.status !== 'PENDING') {
      throw new BadRequestException('Cannot update a transaction that is not pending');
    }

    return this.transactions.update({ where: { id }, data });
  }
}
