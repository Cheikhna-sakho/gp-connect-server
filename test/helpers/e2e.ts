import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';
import { DatabaseService } from 'src/database/database.service';
import { AuthService } from 'src/auth/auth.service';

/**
 * Boot l'app Nest complète en reproduisant FIDÈLEMENT la config globale de
 * `main.ts` (cookie-parser + ValidationPipe + ClassSerializerInterceptor).
 * C'est essentiel : certains bugs ne surgissent qu'avec cette pile (ex. la
 * double-sérialisation qui n'apparaît qu'à cause du ClassSerializerInterceptor
 * global). Les guards globaux (auth + throttler) viennent déjà d'AppModule.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

/**
 * Comptes de test issus du seed (OTP universel non requis : on forge un JWT
 * valide via le vrai AuthService, comme le ferait une session réelle).
 */
const SEED_EMAILS = {
  alice: 'alice@gpconnect.test', // SHIPPER
  marc: 'marc@gpconnect.test', // SHIPPER
  sophie: 'sophie@gpconnect.test', // SHIPPER
  thomas: 'thomas@gpconnect.test', // CARRIER (KYC)
  julie: 'julie@gpconnect.test', // CARRIER
  antoine: 'antoine@gpconnect.test', // CARRIER
  admin: 'admin@gpconnect.test', // ADMIN
} as const;

export type SeedUser = keyof typeof SEED_EMAILS;

export type TestActor = { id: string; token: string; cookie: string };

/**
 * Résout les ids des comptes seed et forge un access token RS256 valide pour
 * chacun (via AuthService.signAccessTokenJwt). Renvoie de quoi authentifier
 * les requêtes supertest, en header Bearer OU en cookie `at`.
 */
export async function loginSeedUsers(
  app: INestApplication,
): Promise<Record<SeedUser, TestActor>> {
  const db = app.get(DatabaseService);
  const auth = app.get(AuthService);

  const actors = {} as Record<SeedUser, TestActor>;
  for (const [key, email] of Object.entries(SEED_EMAILS) as [
    SeedUser,
    string,
  ][]) {
    const user = await db.user.findFirst({ where: { email } });
    if (!user)
      throw new Error(`Seed user introuvable: ${email} (as-tu seedé ?)`);
    const token = auth.signAccessTokenJwt({ id: user.id as never });
    actors[key] = { id: user.id, token, cookie: `at=${token}` };
  }
  return actors;
}
