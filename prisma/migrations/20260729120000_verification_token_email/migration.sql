-- Lie chaque token de vérification EMAIL à l'adresse pour laquelle il a été
-- émis. La bascule d'email ne s'applique que si cette adresse vaut toujours
-- le pending_email du compte au moment du clic (anti prise de contrôle).
ALTER TABLE "verification_tokens" ADD COLUMN "email" TEXT;
