/*
  Warnings:

  - The values [picked_up,in_transit] on the enum `MissionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `mediaId` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `package_id` on the `missions` table. All the data in the column will be lost.
  - The primary key for the `package_medias` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `package_medias` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('pending', 'picked_up', 'in_transit', 'delivered');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('media', 'package', 'text');

-- AlterEnum
BEGIN;
CREATE TYPE "MissionStatus_new" AS ENUM ('pending', 'accepted', 'completed');
ALTER TABLE "missions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "missions" ALTER COLUMN "status" TYPE "MissionStatus_new" USING ("status"::text::"MissionStatus_new");
ALTER TYPE "MissionStatus" RENAME TO "MissionStatus_old";
ALTER TYPE "MissionStatus_new" RENAME TO "MissionStatus";
DROP TYPE "MissionStatus_old";
ALTER TABLE "missions" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_mediaId_fkey";

-- DropForeignKey
ALTER TABLE "missions" DROP CONSTRAINT "missions_package_id_fkey";

-- DropIndex
DROP INDEX "missions_advertisement_id_package_id_key";

-- DropIndex
DROP INDEX "missions_package_id_key";

-- DropIndex
DROP INDEX "package_medias_package_id_media_id_key";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "mediaId",
ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'text';

-- AlterTable
ALTER TABLE "missions" DROP COLUMN "package_id";

-- AlterTable
ALTER TABLE "package_medias" DROP CONSTRAINT "package_medias_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "package_medias_pkey" PRIMARY KEY ("package_id", "media_id");

-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "status" "PackageStatus" NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "mission_packages" (
    "missionId" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,

    CONSTRAINT "mission_packages_pkey" PRIMARY KEY ("missionId","package_id")
);

-- CreateTable
CREATE TABLE "message_packages" (
    "messageId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,

    CONSTRAINT "message_packages_pkey" PRIMARY KEY ("messageId","packageId")
);

-- CreateTable
CREATE TABLE "message_medias" (
    "messageId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,

    CONSTRAINT "message_medias_pkey" PRIMARY KEY ("messageId","mediaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "mission_packages_package_id_key" ON "mission_packages"("package_id");

-- AddForeignKey
ALTER TABLE "mission_packages" ADD CONSTRAINT "mission_packages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_packages" ADD CONSTRAINT "mission_packages_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_packages" ADD CONSTRAINT "message_packages_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_packages" ADD CONSTRAINT "message_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_medias" ADD CONSTRAINT "message_medias_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_medias" ADD CONSTRAINT "message_medias_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "medias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
