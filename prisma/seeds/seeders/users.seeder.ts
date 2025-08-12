import { $Enums } from '@prisma/client';
import { prismaClient } from '../configs/prisma-client';
import { usersFixtures } from '../fixtures';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from '../../../src/users/dtos/user.dto';
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
