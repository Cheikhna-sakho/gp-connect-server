-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'GP');

-- CreateEnum
CREATE TYPE "TransactionMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'PAYPAL');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('kg', 'g');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('XOF', 'EUR', 'USD', 'GBP');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "street" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "zip_code" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL DEFAULT 48.864716,
    "longitude" DOUBLE PRECISION NOT NULL DEFAULT 2.349014,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight_unit" "WeightUnit" NOT NULL DEFAULT 'kg',
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announce_packages" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "announce_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announce_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announces" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "destination_id" TEXT NOT NULL,
    "departure_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transaction_method" "TransactionMethod" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "client_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "annonce_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "transaction_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "addresses_latitude_longitude_key" ON "addresses"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_package_id_key" ON "transactions"("package_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transaction_reference_key" ON "transactions"("transaction_reference");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announce_packages" ADD CONSTRAINT "announce_packages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announce_packages" ADD CONSTRAINT "announce_packages_announce_id_fkey" FOREIGN KEY ("announce_id") REFERENCES "announces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announces" ADD CONSTRAINT "announces_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announces" ADD CONSTRAINT "announces_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announces" ADD CONSTRAINT "announces_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_annonce_id_fkey" FOREIGN KEY ("annonce_id") REFERENCES "announces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
