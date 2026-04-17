import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
const MINUTE_IS_MS = 60_000;
export const generateOtp = async (len = 6, durationMinute = 15) => {
  const plain = Array.from({ length: len }, () => randomInt(0, 10)).join('');
  const hash = await bcrypt.hash(plain, 10);
  const expiresAt = new Date(Date.now() + durationMinute * MINUTE_IS_MS);
  return { plain, hash, expiresAt };
};
type VerifyOtp = { plain: string; hash: string };
export const verifyOtp = async ({ plain, hash }: VerifyOtp) => {
  return bcrypt.compare(plain, hash);
};
