import { prismaClient } from '../configs/prisma-client';
import { CreateAdvertisementDto } from 'src/advertisements/dtos/create-advertisements.dto';
import { addressesFixtures, usersFixtures } from '../fixtures';
const {
  user: userClient,
  address: addressClient,
  advertisement,
} = prismaClient;
const getAddress = async (zipCode: string) => {
  return addressClient.findFirst({
    where: { zipCode },
    select: { id: true },
  });
};
const randomAd = async () => {
  const { id: authorId } = await userClient.findUnique({
    where: { email: usersFixtures[1].email },
    // select: { id: true },
  });
  const [departure, destination] = addressesFixtures;
  const { id: departureId } = await getAddress(departure.zipCode);
  const { id: destinationId } = await getAddress(destination.zipCode);
  //   var tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return {
    authorId,
    arrivalDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    price: 10,
    departureId,
    destinationId,
    maxWeight: 10,
  } satisfies CreateAdvertisementDto;
};
export const seedAdvertisements = async () => {
  try {
    for (let index = 0; index < 25; index++) {
      const data = await randomAd();
      await advertisement.create({ data });
    }
    console.log('yes ad');
  } catch (error) {
    console.log(error);
  }
};
