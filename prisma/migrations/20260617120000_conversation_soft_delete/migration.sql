-- Soft delete des conversations par participant.

-- AlterEnum : nouveau statut DELETED (soft-deleted par les deux parties)
ALTER TYPE "ConversationStatus" ADD VALUE 'deleted';

-- AlterTable : timestamps de suppression par côté
ALTER TABLE "conversations" ADD COLUMN "shipper_deleted_at" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN "carrier_deleted_at" TIMESTAMP(3);
