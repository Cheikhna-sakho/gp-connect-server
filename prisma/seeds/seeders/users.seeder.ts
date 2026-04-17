import { $Enums } from '@prisma/client';
import { prismaClient } from '../configs/prisma-client';
import { usersFixtures } from '../fixtures';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from '../../../src/users/dtos/create-user.dto';
import { validate } from 'class-validator';
const { user } = prismaClient;
export const seedUsers = async () => {
  try {
    for (const u of usersFixtures) {
      const dto = plainToInstance(CreateUserDto, u);
      const errors = await validate(dto);
      if (errors.length > 0) {
        console.error(`Validation failed for user: ${u.firstName} ${u.email}`);
        console.error(errors);
        // throw new Error('Validation error. Aborting seed.');
      }
      await user.upsert({
        where: {
          email: u.email,
        },
        update: {},
        create: {
          ...u,
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
