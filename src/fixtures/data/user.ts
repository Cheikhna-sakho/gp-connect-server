import { faker } from '@faker-js/faker';
import { Prisma, Role } from '@prisma/client';
const randomRole = (): Role => {
  const roles = [Role.GP, Role.USER];
  return roles[Math.floor(Math.random() * roles.length)];
};
const user: Prisma.UserCreateInput = {
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email(),
  password: 'password',
  role: randomRole(),
};
console.log(user);
