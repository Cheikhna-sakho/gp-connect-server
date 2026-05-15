import { prismaClient } from '../configs/prisma-client';
import * as bcrypt from 'bcrypt';

// OTP universel "123456" pré-hashé au seed → tous les comptes de test utilisent ce code
const UNIVERSAL_OTP = '123456';
const OTP_EXPIRES_FAR = new Date('2099-12-31');

export const USERS = {
  admin: {
    email: 'admin@gpconnect.test',
    firstName: 'Admin',
    lastName: 'GPConnect',
    role: 'ADMIN' as const,
  },
  alice: {
    email: 'alice@gpconnect.test',
    firstName: 'Alice',
    lastName: 'Martin',
    role: 'SHIPPER' as const,
  },
  marc: {
    email: 'marc@gpconnect.test',
    firstName: 'Marc',
    lastName: 'Dupont',
    role: 'SHIPPER' as const,
  },
  sophie: {
    email: 'sophie@gpconnect.test',
    firstName: 'Sophie',
    lastName: 'Bernard',
    role: 'SHIPPER' as const,
  },
  thomas: {
    email: 'thomas@gpconnect.test',
    firstName: 'Thomas',
    lastName: 'Lefevre',
    role: 'CARRIER' as const,
  },
  julie: {
    email: 'julie@gpconnect.test',
    firstName: 'Julie',
    lastName: 'Petit',
    role: 'CARRIER' as const,
  },
  antoine: {
    email: 'antoine@gpconnect.test',
    firstName: 'Antoine',
    lastName: 'Roux',
    role: 'CARRIER' as const,
  },
  john: {
    firstName: 'john',
    lastName: 'doe',
    email: 'john.doe@test.com',
    role: 'CARRIER' as const,
  },
  jane: {
    firstName: 'Jane',
    lastName: 'doe',
    role: 'CARRIER' as const,
    email: 'jane.doe@test.com',
  },
};

export type UserMap = Record<keyof typeof USERS, string>; // key → id

export const seedUsers = async (): Promise<UserMap> => {
  const otpHash = await bcrypt.hash(UNIVERSAL_OTP, 10);
  const map = {} as UserMap;
  const now = new Date();

  for (const [key, data] of Object.entries(USERS)) {
    const user = await prismaClient.user.create({
      data: {
        ...data,
        emailVerifiedAt: now,
        // Carriers have phone + identity verified for trust level 3
        phoneVerifiedAt: data.role === 'CARRIER' ? now : null,
        idCardVerifiedAt: key === 'thomas' ? now : null,
        tokens: {
          create: {
            type: 'EMAIL',
            tokenHash: otpHash,
            expiresAt: OTP_EXPIRES_FAR,
          },
        },
        preferences: {
          create: { notifySms: true, notifyEmail: true, notifyPush: true },
        },
      },
    });
    map[key as keyof typeof USERS] = user.id;
  }
  console.log(`✓ ${Object.keys(USERS).length} users (OTP: ${UNIVERSAL_OTP})`);
  return map;
};
