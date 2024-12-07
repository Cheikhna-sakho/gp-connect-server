import { prismaClient } from '../configs/prisma-client';
import { faker } from '@faker-js/faker';
import { usersFixtures } from '../fixtures';
import { CreatePackageDto } from 'src/packages/dtos/package.dto';
const { user: userClient, package: packageClient } = prismaClient;

const randomAd = async () => {
  const { id: ownerId } = await userClient.findUnique({
    where: { email: usersFixtures[0].email },
  });
  return {
    ownerId,
    description: faker.commerce.productDescription(),
    name: faker.commerce.productName(), // or faker.commerce.product() ex:'Computer' or faker.commerce.productMaterial() ex: 'Rubber'
    weight: 0.5,
  } satisfies CreatePackageDto;
};
export const seedPackages = async () => {
  try {
    for (let index = 0; index < 25; index++) {
      const data = await randomAd();
      await packageClient.create({ data });
    }
    console.log('yes ad');
  } catch (error) {
    console.log(error);
  }
};
