import { prismaClient } from '../configs/prisma-client';
import { addressesFixtures } from '../fixtures';

const { address, city, country, state } = prismaClient;
const createCountry = async (data: { name: string; isoCode: string }) => {
  return country.create({ data, select: { id: true } });
};
const createCity = async (data: {
  name: string;
  countryId: string;
  stateId?: string;
}) => {
  return city.create({ data, select: { id: true } });
};
const createState = async (data: { name: string; countryId: string }) => {
  return state.create({ data, select: { id: true } });
};
export const seedAddresses = async () => {
  try {
    addressesFixtures.forEach(
      async ({ city, country, isoCode, state, ...a }) => {
        const { id: countryId } = await createCountry({
          name: country,
          isoCode,
        });
        const { id: stateId } = await createState({ name: state, countryId });
        const { id: cityId } = await createCity({
          name: city,
          countryId,
          stateId,
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
