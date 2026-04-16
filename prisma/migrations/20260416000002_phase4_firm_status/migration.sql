-- Phase 4: Firm onboarding status
-- Existing firms backfilled as 'active' so their intake remains live.
-- New firms created via the admin UI start as 'pending' (Prisma default in schema).

ALTER TABLE "Firm" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
