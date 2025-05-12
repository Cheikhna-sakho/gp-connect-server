/*
  Warnings:

  - You are about to drop the column `avatar` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "avatar";

-- CreateTable
CREATE TABLE "UserAvatar" (
    "user_id" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,

    CONSTRAINT "UserAvatar_pkey" PRIMARY KEY ("user_id","image_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAvatar_user_id_key" ON "UserAvatar"("user_id");

-- AddForeignKey
ALTER TABLE "UserAvatar" ADD CONSTRAINT "UserAvatar_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvatar" ADD CONSTRAINT "UserAvatar_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "medias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
