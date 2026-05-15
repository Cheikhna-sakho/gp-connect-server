-- Rename misleading country_id column to country
ALTER TABLE "cities" RENAME COLUMN "country_id" TO "country";

-- Deduplicate cities before adding unique constraint (keep oldest per name+iso)
DELETE FROM "cities" c1
USING "cities" c2
WHERE c1."name" = c2."name"
  AND c1."country_iso_code" = c2."country_iso_code"
  AND c1."id" > c2."id";

-- Add unique constraint: one city entry per (name, country)
ALTER TABLE "cities" ADD CONSTRAINT "cities_name_country_iso_code_key" UNIQUE ("name", "country_iso_code");
