-- Add IN_TRANSIT status to Mission (carrier has picked up, package in transit)
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'in_transit';

-- Indexes on Advertisement for search performance
CREATE INDEX IF NOT EXISTS "advertisements_type_status_idx" ON "advertisements"("type", "status");
CREATE INDEX IF NOT EXISTS "advertisements_author_id_idx"   ON "advertisements"("author_id");
CREATE INDEX IF NOT EXISTS "advertisements_arrival_date_idx" ON "advertisements"("arrival_date");
