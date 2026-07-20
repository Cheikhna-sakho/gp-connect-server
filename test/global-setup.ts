import { execSync } from 'child_process';

/**
 * globalSetup e2e : provisionne UNE base de test dédiée (jamais la base de dev),
 * une fois avant toute la suite.
 *   1. crée la base `gp_test` si absente (via psql sur la base d'admin `postgres`) ;
 *   2. applique les migrations (`prisma migrate deploy`) ;
 *   3. seed (données de référence : comptes, adresses, annonces, missions).
 * La cible est configurable via `TEST_DATABASE_URL` (défaut : gp_test en local).
 */
export default async function globalSetup(): Promise<void> {
  const url =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5435/gp_test';
  const dbName = new URL(url).pathname.slice(1);
  const adminUrl = url.replace(/\/[^/]+$/, '/postgres');

  const sh = (cmd: string, env: Record<string, string> = {}) =>
    execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

  // 1. Créer la base de test si elle n'existe pas encore.
  const exists = execSync(
    `psql "${adminUrl}" -tAc "SELECT 1 FROM pg_database WHERE datname='${dbName}'"`,
  )
    .toString()
    .trim();
  if (!exists) {
    sh(`psql "${adminUrl}" -c "CREATE DATABASE \\"${dbName}\\""`);
  }

  // 2. Migrations + 3. seed contre la base de test (DATABASE_URL forcé).
  sh('npx prisma migrate deploy', { DATABASE_URL: url });
  sh('npx prisma db seed', { DATABASE_URL: url });
}
