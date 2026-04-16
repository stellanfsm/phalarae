-- Phase 1 auth foundation: enrich AdminUser, add AdminSession

-- AdminUser: add role with safe default for all existing rows
ALTER TABLE "AdminUser" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'firm_admin';

-- AdminUser: optional identity fields
ALTER TABLE "AdminUser" ADD COLUMN "name" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- AdminUser: updatedAt — backfill existing rows with createdAt so history is coherent
ALTER TABLE "AdminUser" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "AdminUser" SET "updatedAt" = "createdAt";

-- Data migration: existing operators (firmId IS NULL) had their role encoded implicitly;
-- make it explicit now. Safe no-op if no operator rows exist.
UPDATE "AdminUser" SET "role" = 'operator' WHERE "firmId" IS NULL;

-- AdminSession: new table for revocable session tracking
CREATE TABLE "AdminSession" (
    "id"         TEXT        NOT NULL,
    "userId"     TEXT        NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "revokedAt"  TIMESTAMP(3),
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- Foreign key: cascade delete sessions when user is deleted
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "AdminUser"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
