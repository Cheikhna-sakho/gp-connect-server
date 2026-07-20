// Exécuté dans CHAQUE worker Jest AVANT le chargement des modules / le boot de
// l'app. Force la connexion sur la base de TEST (jamais la base de dev).
// `process.env.DATABASE_URL` explicite prend le dessus sur le `.env` (Prisma et
// dotenv n'écrasent pas une variable déjà définie).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5435/gp_test';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
