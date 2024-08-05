import { faker } from '@faker-js/faker';
import { Prisma, PrismaClient, Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
export const addressesFixtures: Prisma.AddressCreateInput[] = [
  {
    city: 'paris',
    country: 'france',
    zipCode: '75000',
    latitude: 48.866667,
    longitude: 2.333333,
  },
  {
    city: 'dakar',
    country: 'senegal',
    zipCode: '12500',
    latitude: '14.707295',
    longitude: '-17.443889',
  },
];

const day = 1000 * 60 * 60 * 24;

export const generatePackage = (
  ownerId: string,
): Prisma.PackageUncheckedCreateInput => ({
  ownerId,
  name: faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  weight: 10,
});

export const generateAdvertisement = (
  authorId: string,
  departureId: string,
  destinationId: string,
): Prisma.AdvertisementUncheckedCreateInput => ({
  authorId,
  price: new Decimal(10.0),
  departureDate: new Date(),
  arrivalDate: new Date(Date.now() + day),
  departureId,
  destinationId,
});

const randomRole = (): Role => {
  const roles = [Role.GP, Role.USER];
  return roles[Math.floor(Math.random() * roles.length)];
};
const prisma = new PrismaClient();
// const users: Prisma.UserCreateInput[] = Array.from({ length: 10 }, () => user);
// console.log(users);
Array.from({ length: 10 }).forEach(async () => {
  try {
    const user: Prisma.UserCreateInput = {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      password: 'password',
      role: randomRole(),
    };
    const newUser = await prisma.user.create({ data: user });
    console.log(newUser, 'user created');
    const departure = await prisma.address.findFirst({
      where: { city: addressesFixtures[0].city },
    });
    const destination = await prisma.address.findFirst({
      where: { city: addressesFixtures[1].city },
    });
    const advertisement = generateAdvertisement(
      newUser.id,
      departure.id,
      destination.id,
    );
    const newAdvertisement = await prisma.advertisement.create({
      data: advertisement,
    });
    console.log(newAdvertisement, 'advertisement created');

    if (newUser.role === Role.USER) {
      const packageData = generatePackage(newUser.id);
      const newPackage = await prisma.package.create({ data: packageData });
      await prisma.mission.create({
        data: {
          package: { connect: { id: newPackage.id } },
          advertisement: { connect: { id: newAdvertisement.id } },
          initiator: { connect: { id: newUser.id } },
        },
      });
      console.log(newPackage, 'package created');
    }
  } catch (error) {
    console.error(error);
  }
});
