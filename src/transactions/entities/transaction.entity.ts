import { $Enums, Transaction } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Expose, Type } from 'class-transformer';

export class TransactionEntity implements Transaction {
  @Expose() id: string;

  @Type(() => Number)
  @Expose()
  amount: Decimal;

  @Expose() method: $Enums.TransactionMethod;

  @Expose() status: $Enums.TransactionStatus;

  @Expose() missionId: string;

  @Expose() transactionReference: string;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<Transaction>) {
    Object.assign(this, partial);
  }
}
