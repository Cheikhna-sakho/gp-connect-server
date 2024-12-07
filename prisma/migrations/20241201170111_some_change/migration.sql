/*
  Warnings:

  - The values [delivered] on the enum `MissionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `last_message_id` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the `conversation_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `message_medias` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `carrierId` to the `conversations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shipperId` to the `conversations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MissionStatus_new" AS ENUM ('pending', 'accepted', 'picked_up', 'in_transit', 'completed');
ALTER TABLE "missions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "missions" ALTER COLUMN "status" TYPE "MissionStatus_new" USING ("status"::text::"MissionStatus_new");
ALTER TYPE "MissionStatus" RENAME TO "MissionStatus_old";
ALTER TYPE "MissionStatus_new" RENAME TO "MissionStatus";
DROP TYPE "MissionStatus_old";
ALTER TABLE "missions" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;

-- DropForeignKey
ALTER TABLE "conversation_users" DROP CONSTRAINT "conversation_users_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "conversation_users" DROP CONSTRAINT "conversation_users_user_id_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_last_message_id_fkey";

-- DropForeignKey
ALTER TABLE "message_medias" DROP CONSTRAINT "message_medias_media_id_fkey";

-- DropForeignKey
ALTER TABLE "message_medias" DROP CONSTRAINT "message_medias_message_id_fkey";

-- DropIndex
DROP INDEX "conversations_last_message_id_key";

-- AlterTable
ALTER TABLE "conversations" DROP COLUMN "last_message_id",
ADD COLUMN     "carrierId" TEXT NOT NULL,
ADD COLUMN     "shipperId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "medias" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "mediaId" TEXT;

-- DropTable
DROP TABLE "conversation_users";

-- DropTable
DROP TABLE "message_medias";

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "medias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
