import { $Enums } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateTransactionDto {
  @IsEnum($Enums.TransactionMethod)
  @IsOptional()
  method?: $Enums.TransactionMethod;
}
