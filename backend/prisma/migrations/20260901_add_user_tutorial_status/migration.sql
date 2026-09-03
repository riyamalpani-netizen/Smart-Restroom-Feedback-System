-- Existing accounts should not receive a first-time-only tour after this feature
-- is deployed. Accounts created after this migration start as pending.
ALTER TABLE "users"
ADD COLUMN "tutorialStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "tutorialCompletedAt" TIMESTAMP(3);

UPDATE "users"
SET "tutorialStatus" = 'completed';
