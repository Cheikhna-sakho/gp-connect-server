// import { prismaClient } from 'prisma/configs/prisma-client';
// import { addressesFixtures } from 'prisma/fixtures';

// const { address } = prismaClient;
// export const seedUsers = () => {
//   try {
//     addressesFixtures.forEach(async ({ city, ...a }) => {
//       delete a.country;
//       address.create({
//         data: {
//           ...a,
//           city: {
//             connectOrCreate: {
//               where: { name: city },
//               create: { name: city },
//             },
//           },
//         },
//       });
//     });
//     // address.createMany({ data: {} });
//   } catch (error) {
//     console.log(error);
//   }
// };
