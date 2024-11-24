import { prismaClient } from './configs/prisma-client';
import { seedUsers } from './seeders/users.seeder';

const main = async () => {
  try {
    await seedUsers();
  } catch (error) {
    console.error(error);
  }
};
main()
  .catch((error) => console.error(error))
  .finally(() => prismaClient.$disconnect());
