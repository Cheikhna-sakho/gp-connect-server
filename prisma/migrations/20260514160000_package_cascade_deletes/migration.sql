-- package_medias: cascade when Package OR Media is deleted
ALTER TABLE "package_medias" DROP CONSTRAINT IF EXISTS "package_medias_package_id_fkey";
ALTER TABLE "package_medias" ADD CONSTRAINT "package_medias_package_id_fkey"
  FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_medias" DROP CONSTRAINT IF EXISTS "package_medias_media_id_fkey";
ALTER TABLE "package_medias" ADD CONSTRAINT "package_medias_media_id_fkey"
  FOREIGN KEY ("media_id") REFERENCES "medias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- mission_packages: cascade when Mission is deleted (packages are independent, not cascaded)
ALTER TABLE "mission_packages" DROP CONSTRAINT IF EXISTS "mission_packages_missionId_fkey";
ALTER TABLE "mission_packages" ADD CONSTRAINT "mission_packages_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
