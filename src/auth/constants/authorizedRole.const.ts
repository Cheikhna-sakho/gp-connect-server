import { Role } from '@prisma/client';

export const authorizedRoles = {
  AdminAndGp: [Role.ADMIN, Role.CARRIER],
};
