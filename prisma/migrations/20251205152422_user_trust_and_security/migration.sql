/*
  Warnings:

  - The values [delivery_request,delivery_offer] on the enum `AdvertisementType` will be removed. If these variants are still used in the database, this will fail.
  - The values [user,gp] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `acceptor_id` on the `missions` table. All the data in the column will be lost.
  - You are about to drop the column `initiator_id` on the `missions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `shipper_id` to the `missions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserIdentityStatus" AS ENUM ('pending', 'verified', 'rejected', 'requires_input', 'canceled');

-- CreateEnum
CREATE TYPE "UserIdentityProvider" AS ENUM ('stripe_identity');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('google');

-- CreateEnum
CREATE TYPE "VerificationTokenType" AS ENUM ('email', 'phone');

-- CreateEnum
CREATE TYPE "ProofType" AS ENUM ('PICKUP', 'DELIVERY', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "AdvertisementType_new" AS ENUM ('shipping', 'delivery');
ALTER TABLE "advertisements" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "advertisements" ALTER COLUMN "type" TYPE "AdvertisementType_new" USING ("type"::text::"AdvertisementType_new");
ALTER TYPE "AdvertisementType" RENAME TO "AdvertisementType_old";
ALTER TYPE "AdvertisementType_new" RENAME TO "AdvertisementType";
DROP TYPE "AdvertisementType_old";
ALTER TABLE "advertisements" ALTER COLUMN "type" SET DEFAULT 'delivery';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MissionStatus" ADD VALUE 'canceled';
ALTER TYPE "MissionStatus" ADD VALUE 'disputed';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('shipper', 'admin', 'carrier');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'shipper';
COMMIT;

-- DropForeignKey
ALTER TABLE "missions" DROP CONSTRAINT "missions_acceptor_id_fkey";

-- DropForeignKey
ALTER TABLE "missions" DROP CONSTRAINT "missions_initiator_id_fkey";

-- AlterTable
ALTER TABLE "advertisements" ALTER COLUMN "type" SET DEFAULT 'delivery';

-- AlterTable
ALTER TABLE "missions" DROP COLUMN "acceptor_id",
DROP COLUMN "initiator_id",
ADD COLUMN     "carrier_id" TEXT,
ADD COLUMN     "shipper_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ADD COLUMN     "id_card_verified_at" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phone_verified_at" TIMESTAMP(3),
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'shipper';

-- CreateTable
CREATE TABLE "user_identities" (
    "provider" "UserIdentityProvider" NOT NULL,
    "provider_id" TEXT NOT NULL,
    "status" "UserIdentityStatus" NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT,
    "expired_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "user_providers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "VerificationTokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_proofs" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "type" "ProofType" NOT NULL,
    "otp_hash" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "otp_used_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "verified_by_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_proof_images" (
    "id" TEXT NOT NULL,
    "proof_id" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_proof_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_user_id_provider_key" ON "user_identities"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_provider_id_key" ON "user_identities"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_providers_provider_provider_user_id_key" ON "user_providers"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_providers_user_id_provider_key" ON "user_providers"("user_id", "provider");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_type_idx" ON "verification_tokens"("user_id", "type");

-- CreateIndex
CREATE INDEX "delivery_proofs_mission_id_idx" ON "delivery_proofs"("mission_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_proofs_mission_id_type_key" ON "delivery_proofs"("mission_id", "type");

-- CreateIndex
CREATE INDEX "delivery_proof_images_proof_id_idx" ON "delivery_proof_images"("proof_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_providers" ADD CONSTRAINT "user_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_shipper_id_fkey" FOREIGN KEY ("shipper_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proof_images" ADD CONSTRAINT "delivery_proof_images_proof_id_fkey" FOREIGN KEY ("proof_id") REFERENCES "delivery_proofs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proof_images" ADD CONSTRAINT "delivery_proof_images_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "medias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
