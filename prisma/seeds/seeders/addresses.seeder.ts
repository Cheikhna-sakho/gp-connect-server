import { prismaClient } from '../configs/prisma-client';
import { addressesFixtures } from '../fixtures';

const { address, city } = prismaClient;

const createCity = async (data: {
  name: string;
  country: string;
  countryIsoCode: string;
}) => {
  const exist = await city.findFirst({
    where: { name: data.name, countryIsoCode: data.countryIsoCode },
  });
  return city.upsert({
    where: { id: exist?.id ?? '' },
    create: data,
    update: {},
    select: { id: true },
  });
};

export const seedAddresses = async () => {
  try {
    addressesFixtures.forEach(
      async ({ city, country, countryIsoCode, ...a }) => {
        const { id: cityId } = await createCity({
          name: city,
          country,
          countryIsoCode,
        });
        await address.upsert({
          where: {
            latitude_longitude: {
              latitude: a.latitude,
              longitude: a.longitude,
            },
          },
          update: {},
          create: {
            ...a,
            city: {
              connect: { id: cityId },
            },
          },
        });
      },
    );
    console.log('address created');
    // address.createMany({ data: {} });
  } catch (error) {
    console.log(error);
  }
};
