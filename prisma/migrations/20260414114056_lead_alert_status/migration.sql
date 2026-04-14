-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "alertError" TEXT,
ADD COLUMN     "alertStatus" TEXT NOT NULL DEFAULT 'no_recipient';
