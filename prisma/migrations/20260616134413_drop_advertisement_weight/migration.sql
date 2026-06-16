-- Drop the unused `weight` column on advertisements.
-- La capacité est portée par `max_weight`; le poids consommé est calculé
-- dynamiquement (cumulatedWeight) à partir des missions actives.
ALTER TABLE "advertisements" DROP COLUMN "weight";
