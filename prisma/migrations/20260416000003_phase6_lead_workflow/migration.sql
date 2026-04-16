-- Phase 6: Lead workflow state
--
-- Backfill strategy:
--   Existing leads → workflowStatus = 'open' (they predate the new system; do not flood the new queue)
--                    reviewedAt = createdAt (treated as already reviewed at submission time)
--   New leads      → workflowStatus = 'new' (DB default switched after backfill)
--                    reviewedAt = NULL (set server-side on first detail page view)

-- Step 1: Add reviewedAt (nullable, no inline default needed)
ALTER TABLE "Lead" ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- Step 2: Backfill reviewedAt for all existing leads
UPDATE "Lead" SET "reviewedAt" = "createdAt";

-- Step 3: Add workflowStatus with DEFAULT 'open' — this backfills all existing rows as 'open'
ALTER TABLE "Lead" ADD COLUMN "workflowStatus" TEXT NOT NULL DEFAULT 'open';

-- Step 4: Switch the DB-level default to 'new' for new rows going forward
--         (Prisma @default("new") in schema.prisma is the application-level default;
--          this ensures the DB-level default also matches for any direct inserts)
ALTER TABLE "Lead" ALTER COLUMN "workflowStatus" SET DEFAULT 'new';
