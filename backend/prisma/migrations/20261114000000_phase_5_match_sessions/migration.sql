-- A session marker records the last durable match position visible when an
-- anonymous viewer joined. It deliberately stores provider-neutral ordering
-- fields rather than a display over/ball label.
CREATE TABLE "MatchSession" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "joinedInningsNumber" INTEGER,
    "joinedDeliverySequence" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "MatchSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatchSession_matchId_leftAt_idx" ON "MatchSession"("matchId", "leftAt");

ALTER TABLE "MatchSession" ADD CONSTRAINT "MatchSession_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
