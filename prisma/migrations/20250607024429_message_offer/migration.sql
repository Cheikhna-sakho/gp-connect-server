/*
  Warnings:

  - You are about to drop the `Offer` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[advertisement_id,shipperId,carrierId]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MessageOfferStatus" AS ENUM ('pending', 'accepted');

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_messageId_fkey";

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_missionId_fkey";

-- DropTable
DROP TABLE "Offer";

-- CreateTable
CREATE TABLE "message_offers" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "weight" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "message_id" TEXT NOT NULL,
    "mission_id" TEXT,
    "status" "MessageOfferStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "message_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_offers_message_id_key" ON "message_offers"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_advertisement_id_shipperId_carrierId_key" ON "conversations"("advertisement_id", "shipperId", "carrierId");

-- AddForeignKey
ALTER TABLE "message_offers" ADD CONSTRAINT "message_offers_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_offers" ADD CONSTRAINT "message_offers_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
