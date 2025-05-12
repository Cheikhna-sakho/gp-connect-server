import { prismaClient } from '../configs/prisma-client';
import { addressesFixtures } from '../fixtures';

const { address, city } = prismaClient;

const createCity = async (data: {
  name: string;
  country: string;
  countryIsoCode: string;
}) => {
  return city.create({ data, select: { id: true } });
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
        await address.create({
          data: {
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
