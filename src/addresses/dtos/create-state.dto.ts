import { Prisma } from '@prisma/client';

export class CreateStateDto implements Prisma.StateUncheckedCreateInput {
  name: string;
  countryId: string;
}
