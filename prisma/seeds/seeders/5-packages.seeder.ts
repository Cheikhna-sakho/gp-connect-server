import { faker } from '@faker-js/faker/locale/fr';
import { Decimal } from '@prisma/client/runtime/library';
import { prismaClient } from '../configs/prisma-client';
import { UserMap } from './2-users.seeder';

faker.seed(99);

// Packages supplémentaires dans l'inventaire des shippers (non liés à une mission)
export const seedPackages = async (users: UserMap, existingIds: string[]) => {
  const db = prismaClient;
  let count = 0;

  const shippers = [users.alice, users.marc, users.sophie];
  for (const ownerId of shippers) {
    for (let i = 0; i < 3; i++) {
      await db.package.create({
        data: {
          name: faker.commerce.productName(),
          description: faker.helpers.maybe(
            () => faker.commerce.productDescription(),
            { probability: 0.5 },
          ),
          weight: new Decimal(faker.number.float({ min: 0.2, max: 15, fractionDigits: 1 })),
          ownerId,
        },
      });
      count++;
    }
  }
  console.log(`✓ ${count} extra packages`);
};
