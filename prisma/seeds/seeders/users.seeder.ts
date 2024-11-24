import { $Enums } from '@prisma/client';
import { prismaClient } from '../configs/prisma-client';
import { usersFixtures } from '../fixtures';
import * as bcrypt from 'bcrypt';
const { user } = prismaClient;
export const seedUsers = async () => {
  try {
    for (const u of usersFixtures) {
      const password = await bcrypt.hash(u.password, 10);
      await user.create({
        data: {
          ...u,
          password,
          role: u.role as $Enums.Role,
        },
      });
    }
    console.log({
      message: usersFixtures
        .map(
          ({ firstName, lastName }) =>
            `${firstName} ${lastName} has been created`,
        )
        .join('\n'),
    });
  } catch (error) {
    console.log(error);
  }
};
