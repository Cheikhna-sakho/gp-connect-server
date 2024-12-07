/*
  Warnings:

  - You are about to drop the column `receiver_id` on the `messages` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_receiver_id_fkey";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "receiver_id";
