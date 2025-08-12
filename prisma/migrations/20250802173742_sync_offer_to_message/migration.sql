/*
  Warnings:

  - You are about to drop the column `message_id` on the `message_offers` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "MessageOfferStatus" ADD VALUE 'rejected';

-- DropForeignKey
ALTER TABLE "message_offers" DROP CONSTRAINT "message_offers_message_id_fkey";

-- DropIndex
DROP INDEX "message_offers_message_id_key";

-- AlterTable
ALTER TABLE "message_offers" DROP COLUMN "message_id";

-- AddForeignKey
ALTER TABLE "message_offers" ADD CONSTRAINT "message_offers_id_fkey" FOREIGN KEY ("id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
