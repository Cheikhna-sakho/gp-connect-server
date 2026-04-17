import { $Enums, Prisma } from '@prisma/client';
import { DecimalJsLike } from '@prisma/client/runtime/library';

export class CreateOfferDto implements Prisma.MessageOfferUncheckedCreateInput {
  id: string;
  price: string | number | Prisma.Decimal | DecimalJsLike;
  weight?: string | number | Prisma.Decimal | DecimalJsLike;
  missionId?: string;
  status?: $Enums.MessageOfferStatus;
}
