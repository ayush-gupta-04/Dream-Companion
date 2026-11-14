-- Clerk remains the identity source of truth. Existing anonymous session
-- markers are retained for audit history but are never reusable by a signed-in
-- user because session lookups require clerkUserId.
ALTER TABLE "MatchSession" ADD COLUMN "clerkUserId" TEXT;
ALTER TABLE "MatchSession" ADD COLUMN "clerkSessionId" TEXT;

CREATE INDEX "MatchSession_matchId_clerkUserId_leftAt_idx"
ON "MatchSession"("matchId", "clerkUserId", "leftAt");
