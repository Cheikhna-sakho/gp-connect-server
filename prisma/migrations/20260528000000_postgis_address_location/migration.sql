-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography column to addresses
ALTER TABLE "addresses"
  ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326);

-- Backfill existing rows that already have lat/lng
UPDATE "addresses"
SET "location" = ST_SetSRID(
  ST_MakePoint(longitude::float, latitude::float),
  4326
)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Spatial index for ST_DWithin performance
CREATE INDEX IF NOT EXISTS "addresses_location_gist"
  ON "addresses" USING GIST ("location");
