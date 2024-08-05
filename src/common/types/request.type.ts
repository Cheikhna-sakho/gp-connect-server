import { JwtPayload } from 'src/auth/types/jwt.type';

export type AuthRequest = {
  user: JwtPayload;
};
