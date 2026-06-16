-- Compteur de tentatives de vérification du code de preuve (anti brute-force).
ALTER TABLE "delivery_proofs" ADD COLUMN "otp_attempts" INTEGER NOT NULL DEFAULT 0;
