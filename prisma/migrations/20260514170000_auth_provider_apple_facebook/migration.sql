-- ALTER TYPE enum values — must run outside a transaction block in PG < 12
-- In PG 12+ this is allowed inside transactions
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'apple';
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'facebook';
