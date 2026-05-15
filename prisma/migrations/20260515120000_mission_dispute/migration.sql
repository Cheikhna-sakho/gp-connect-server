CREATE TYPE "DisputeStatus" AS ENUM ('open', 'resolved');

CREATE TABLE "mission_disputes" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "mission_id"    TEXT NOT NULL UNIQUE,
  "opened_by_id"  TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  "description"   TEXT,
  "status"        "DisputeStatus" NOT NULL DEFAULT 'open',
  "resolution"    TEXT,
  "resolved_by_id" TEXT,
  "resolved_at"   TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mission_disputes_mission_id_fkey"
    FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mission_disputes_opened_by_id_fkey"
    FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "mission_disputes_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
