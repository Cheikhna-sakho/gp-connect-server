/*
  Warnings:

  - The values [package] on the enum `MessageType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `state_id` on the `cities` table. All the data in the column will be lost.
  - You are about to drop the `UserAvatar` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `countries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `message_packages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `states` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `country_iso_code` to the `cities` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MessageType_new" AS ENUM ('media', 'offer', 'text');
ALTER TABLE "messages" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "messages" ALTER COLUMN "type" TYPE "MessageType_new" USING ("type"::text::"MessageType_new");
ALTER TYPE "MessageType" RENAME TO "MessageType_old";
ALTER TYPE "MessageType_new" RENAME TO "MessageType";
DROP TYPE "MessageType_old";
ALTER TABLE "messages" ALTER COLUMN "type" SET DEFAULT 'text';
COMMIT;

-- DropForeignKey
ALTER TABLE "UserAvatar" DROP CONSTRAINT "UserAvatar_image_id_fkey";

-- DropForeignKey
ALTER TABLE "UserAvatar" DROP CONSTRAINT "UserAvatar_user_id_fkey";

-- DropForeignKey
ALTER TABLE "cities" DROP CONSTRAINT "cities_country_id_fkey";

-- DropForeignKey
ALTER TABLE "cities" DROP CONSTRAINT "cities_state_id_fkey";

-- DropForeignKey
ALTER TABLE "message_packages" DROP CONSTRAINT "message_packages_messageId_fkey";

-- DropForeignKey
ALTER TABLE "message_packages" DROP CONSTRAINT "message_packages_packageId_fkey";

-- DropForeignKey
ALTER TABLE "states" DROP CONSTRAINT "states_country_id_fkey";

-- AlterTable
ALTER TABLE "advertisements" ADD COLUMN     "weight" DECIMAL(7,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "cities" DROP COLUMN "state_id",
ADD COLUMN     "country_iso_code" TEXT NOT NULL;

-- DropTable
DROP TABLE "UserAvatar";

-- DropTable
DROP TABLE "countries";

-- DropTable
DROP TABLE "message_packages";

-- DropTable
DROP TABLE "states";

-- CreateTable
CREATE TABLE "user_avatar" (
    "user_id" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,

    CONSTRAINT "user_avatar_pkey" PRIMARY KEY ("user_id","image_id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "weight" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "messageId" TEXT NOT NULL,
    "missionId" TEXT,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_avatar_user_id_key" ON "user_avatar"("user_id");

-- AddForeignKey
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "medias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
