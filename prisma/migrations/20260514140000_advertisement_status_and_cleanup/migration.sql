-- Add AdvertisementStatus enum
CREATE TYPE "AdvertisementStatus" AS ENUM ('open', 'in_progress', 'completed', 'closed');

-- Add status column to advertisements (default open for existing rows)
ALTER TABLE "advertisements" ADD COLUMN "status" "AdvertisementStatus" NOT NULL DEFAULT 'open';

-- Drop the dead ShippingPAckages table (never referenced in application code)
DROP TABLE IF EXISTS "ShippingPAckages";
