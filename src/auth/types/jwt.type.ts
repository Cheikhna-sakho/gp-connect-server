import { Role } from '@prisma/client';

export type JwtPayload = {
  id: string;
  email: string;
  role: Role;
};
