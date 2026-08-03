-- Généralise le lien token → canal : la colonne ne portait que l'adresse des
-- liens EMAIL, elle porte désormais l'identifiant exact (email OU téléphone)
-- auquel le token a été envoyé. Permet d'appliquer aux OTP téléphone le même
-- contrôle qu'aux liens email : un code prouvant le contrôle de l'ancien
-- numéro ne peut plus valider le nouveau posé entre-temps.
ALTER TABLE "verification_tokens" RENAME COLUMN "email" TO "identifier";
