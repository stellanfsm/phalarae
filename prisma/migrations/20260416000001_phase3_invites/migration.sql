-- Phase 3: AdminInvite table for firm user invite flow

CREATE TABLE "AdminInvite" (
    "id"          TEXT NOT NULL,
    "firmId"      TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "role"        TEXT NOT NULL DEFAULT 'firm_admin',
    "token"       TEXT NOT NULL,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "usedAt"      TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminInvite_token_key" ON "AdminInvite"("token");

ALTER TABLE "AdminInvite"
    ADD CONSTRAINT "AdminInvite_firmId_fkey"
    FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminInvite"
    ADD CONSTRAINT "AdminInvite_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
