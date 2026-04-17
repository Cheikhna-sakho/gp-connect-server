/*
  Warnings:

  - Added the required column `mission_id` to the `conversations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `message_offers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "PackageStatus" ADD VALUE 'disputed';

-- DropForeignKey
ALTER TABLE "message_offers" DROP CONSTRAINT "message_offers_id_fkey";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "mission_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "message_offers" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_offers" ADD CONSTRAINT "message_offers_id_fkey" FOREIGN KEY ("id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
