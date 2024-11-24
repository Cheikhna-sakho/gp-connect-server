/*
  Warnings:

  - A unique constraint covering the columns `[city_id,zip_code]` on the table `addresses` will be added. If there are existing duplicate values, this will fail.
  - Made the column `zip_code` on table `addresses` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `country_id` to the `cities` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "cities" DROP CONSTRAINT "cities_state_id_fkey";

-- AlterTable
ALTER TABLE "addresses" ALTER COLUMN "zip_code" SET NOT NULL;

-- AlterTable
ALTER TABLE "cities" ADD COLUMN     "country_id" TEXT NOT NULL,
ALTER COLUMN "state_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "addresses_city_id_zip_code_key" ON "addresses"("city_id", "zip_code");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
