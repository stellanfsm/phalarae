-- Phase 8: Lead collaboration (notes + assignment)
--
-- LeadNote: append-only internal notes, scoped to a lead.
--   CASCADE on lead   — notes are owned by the lead.
--   RESTRICT on author — prevents hard-deleting an AdminUser who has notes
--                        (AdminUsers are soft-deleted via deactivatedAt in practice).
--
-- Lead.assignedToId: nullable FK to AdminUser.
--   SET NULL on delete — lead becomes unassigned if the user is ever hard-deleted.
--
-- No backfill needed — all new columns are nullable.

CREATE TABLE "LeadNote" (
  "id"        TEXT         NOT NULL,
  "leadId"    TEXT         NOT NULL,
  "authorId"  TEXT         NOT NULL,
  "content"   TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadNote_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "LeadNote_leadId_fkey"   FOREIGN KEY ("leadId")   REFERENCES "Lead"("id")      ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "LeadNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "LeadNote_leadId_idx" ON "LeadNote"("leadId");

ALTER TABLE "Lead" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "assignedAt"   TIMESTAMP(3);

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
