import { prismaClient } from './configs/prisma-client';
import { seedCities } from './seeders/1-cities.seeder';
import { seedUsers } from './seeders/2-users.seeder';
import { seedAddresses } from './seeders/3-addresses.seeder';
import { seedAdvertisements } from './seeders/4-advertisements.seeder';
import { seedPackages } from './seeders/5-packages.seeder';
import { seedScenarios } from './seeders/6-scenarios.seeder';

const wipe = async () => {
  await prismaClient.missionRating.deleteMany();
  await prismaClient.missionProofImage.deleteMany();
  await prismaClient.missionProof.deleteMany();
  await prismaClient.messageOffer.deleteMany();
  await prismaClient.messageMedia.deleteMany();
  await prismaClient.message.deleteMany();
  await prismaClient.conversation.deleteMany();
  await prismaClient.transaction.deleteMany();
  await prismaClient.missionPackage.deleteMany();
  await prismaClient.mission.deleteMany();
  await prismaClient.packageMedia.deleteMany();
  await prismaClient.package.deleteMany();
  await prismaClient.advertisement.deleteMany();
  await prismaClient.userAvatar.deleteMany();
  await prismaClient.savedAddress.deleteMany();
  await prismaClient.userPreferences.deleteMany();
  await prismaClient.verificationToken.deleteMany();
  await prismaClient.userIdentity.deleteMany();
  await prismaClient.userProvider.deleteMany();
  await prismaClient.user.deleteMany();
  await prismaClient.address.deleteMany();
  await prismaClient.city.deleteMany();
  console.log('✓ DB wiped');
};

const main = async () => {
  console.log('\n🌱 Starting seed...\n');

  await wipe();

  const cities = await seedCities();
  const users = await seedUsers();
  const addresses = await seedAddresses(cities);
  const { ads, packages } = await seedAdvertisements(users, addresses);
  await seedPackages(users, packages);
  await seedScenarios(users, addresses, ads);

  console.log('\n✅ Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 TEST ACCOUNTS  —  OTP universel: 123456');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SHIPPERS:');
  console.log('  alice@gpconnect.test    Alice Martin');
  console.log('  marc@gpconnect.test     Marc Dupont');
  console.log('  sophie@gpconnect.test   Sophie Bernard');
  console.log('CARRIERS:');
  console.log('  thomas@gpconnect.test   Thomas Lefevre (top rated)');
  console.log('  julie@gpconnect.test    Julie Petit');
  console.log('  antoine@gpconnect.test  Antoine Roux');
  console.log('ADMIN:');
  console.log('  admin@gpconnect.test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
};

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prismaClient.$disconnect());
