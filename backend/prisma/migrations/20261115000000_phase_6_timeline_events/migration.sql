-- Timeline events are derived from durable delivery facts. The event key is
-- stable per match and supports idempotent reconciliation after corrections.
CREATE TYPE "TimelineEventType" AS ENUM (
    'WICKET',
    'FOUR',
    'SIX',
    'BATTER_MILESTONE',
    'PARTNERSHIP_MILESTONE',
    'MAIDEN_OVER',
    'EXPENSIVE_OVER',
    'SCORING_RATE_SHIFT'
);

CREATE TYPE "TimelineImportanceLevel" AS ENUM ('MINOR', 'HIGHLIGHT', 'MAJOR');

CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "deliverySequence" INTEGER NOT NULL,
    "eventOrder" INTEGER NOT NULL,
    "displayOver" INTEGER NOT NULL,
    "displayBallLabel" TEXT NOT NULL,
    "type" "TimelineEventType" NOT NULL,
    "eventKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "importanceScore" INTEGER NOT NULL,
    "importanceLevel" "TimelineImportanceLevel" NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimelineEvent_matchId_eventKey_key" ON "TimelineEvent"("matchId", "eventKey");
CREATE UNIQUE INDEX "TimelineEvent_inningsId_deliverySequence_eventOrder_key"
ON "TimelineEvent"("inningsId", "deliverySequence", "eventOrder");
CREATE INDEX "TimelineEvent_matchId_inningsId_deliverySequence_eventOrder_idx"
ON "TimelineEvent"("matchId", "inningsId", "deliverySequence", "eventOrder");

ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_inningsId_fkey"
FOREIGN KEY ("inningsId") REFERENCES "Innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_deliveryId_fkey"
FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
