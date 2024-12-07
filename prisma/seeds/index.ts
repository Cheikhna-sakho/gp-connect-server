import { prismaClient } from './configs/prisma-client';
// import { seedAddresses } from './seeders/addresses.seeder';
import { seedAdvertisements } from './seeders/advertisement.seeder';
// import { seedPackages } from './seeders/packages.seeder';
// import { seedUsers } from './seeders/users.seeder';

const main = async () => {
  try {
    // await seedAddresses();
    await seedAdvertisements();
    // await seedPackages();
  } catch (error) {
    console.error(error);
  }
};
main()
  .catch((error) => console.error(error))
  .finally(() => prismaClient.$disconnect());
