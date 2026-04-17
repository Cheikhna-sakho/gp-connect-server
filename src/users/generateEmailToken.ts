import { BinaryToTextEncoding, createHash, randomBytes } from 'crypto';

const digest: BinaryToTextEncoding = 'hex';
const hashAlgorithm = 'sha256';

export const generateEmailToken = () => {
  const token = randomBytes(32).toString(digest);
  const hash = getHashFromToken(token);
  return { token, hash };
};

export const getHashFromToken = (token: string) => {
  return createHash(hashAlgorithm).update(token).digest(digest);
};
