-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('pickup', 'delivery');

-- CreateEnum
CREATE TYPE "MessageAppointmentStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'appointment';

-- CreateTable
CREATE TABLE "message_appointments" (
    "id" TEXT NOT NULL,
    "type" "AppointmentType" NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "MessageAppointmentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_appointments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "message_appointments" ADD CONSTRAINT "message_appointments_id_fkey" FOREIGN KEY ("id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
