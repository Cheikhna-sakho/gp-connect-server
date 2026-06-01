-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_mission_id_fkey";

-- DropIndex
DROP INDEX "addresses_location_gist";

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
