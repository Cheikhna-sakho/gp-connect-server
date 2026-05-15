-- UserPreferences: notification settings per user
CREATE TABLE "user_preferences" (
  "user_id"      TEXT NOT NULL PRIMARY KEY,
  "notify_sms"   BOOLEAN NOT NULL DEFAULT true,
  "notify_email" BOOLEAN NOT NULL DEFAULT true,
  "notify_push"  BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- SavedAddress: user's bookmarked addresses
CREATE TABLE "saved_addresses" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "user_id"    TEXT NOT NULL,
  "address_id" TEXT NOT NULL,
  "label"      TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_addresses_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "saved_addresses_address_id_fkey"
    FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "saved_addresses_user_id_address_id_key" ON "saved_addresses"("user_id", "address_id");

-- MissionRating: post-delivery ratings between shipper and carrier
CREATE TABLE "mission_ratings" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "mission_id" TEXT NOT NULL,
  "rater_id"   TEXT NOT NULL,
  "rated_id"   TEXT NOT NULL,
  "score"      INTEGER NOT NULL,
  "comment"    TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mission_ratings_mission_id_fkey"
    FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mission_ratings_rater_id_fkey"
    FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "mission_ratings_rated_id_fkey"
    FOREIGN KEY ("rated_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "mission_ratings_mission_id_rater_id_key" ON "mission_ratings"("mission_id", "rater_id");
