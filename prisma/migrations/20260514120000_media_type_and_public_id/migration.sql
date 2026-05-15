-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'audio', 'video');

-- AlterTable: convert existing string values and add public_id
ALTER TABLE "medias"
  ADD COLUMN "public_id" TEXT,
  ALTER COLUMN "type" TYPE "MediaType" USING "type"::"MediaType";
