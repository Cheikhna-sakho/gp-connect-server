import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
const MINUTE_IS_MS = 60_000;

// Backdoor e2e : E2E_FIXED_OTP force un code déterministe pour les tests
// navigateur (login + preuves). Ignoré en production quoi qu'il arrive.
const getFixedOtp = (len: number) => {
  const fixed = process.env.E2E_FIXED_OTP;
  if (!fixed || process.env.NODE_ENV === 'production') return null;
  return fixed.length === len ? fixed : null;
};

export const generateOtp = async (len = 6, durationMinute = 15) => {
  const plain =
    getFixedOtp(len) ??
    Array.from({ length: len }, () => randomInt(0, 10)).join('');
  const hash = await bcrypt.hash(plain, 10);
  const expiresAt = new Date(Date.now() + durationMinute * MINUTE_IS_MS);
  return { plain, hash, expiresAt };
};
type VerifyOtp = { plain: string; hash: string };
export const verifyOtp = async ({ plain, hash }: VerifyOtp) => {
  return bcrypt.compare(plain, hash);
};
