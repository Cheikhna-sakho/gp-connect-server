// import { faker } from '@faker-js/faker';
// import { Address } from '@prisma/client';

import { Prisma } from '@prisma/client';

// const address: Address = {} as Address;

// for (let index = 0; index < ; index++) {
//     const element = array[index];

// }
export const addresses: Prisma.AddressCreateInput[] = [
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
