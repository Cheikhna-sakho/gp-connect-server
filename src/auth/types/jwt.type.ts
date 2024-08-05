import { Role } from '@prisma/client';
import { UUID } from 'crypto';

export type JwtPayload = {
  id: UUID;
  email: string;
  role: Role;
};
