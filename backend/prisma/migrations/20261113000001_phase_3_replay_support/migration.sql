-- Store the number of legal balls that make up an over in the source match.
ALTER TABLE "Match" ADD COLUMN "ballsPerOver" INTEGER NOT NULL DEFAULT 6;

-- Cricsheet can apply penalty runs before or after an innings, rather than to a delivery.
ALTER TABLE "Innings" ADD COLUMN "prePenaltyRuns" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Innings" ADD COLUMN "postPenaltyRuns" INTEGER NOT NULL DEFAULT 0;

-- Source delivery identifiers are optional for direct domain use, but unique when supplied by an adapter.
CREATE UNIQUE INDEX "Delivery_inningsId_sourceDeliveryId_key"
ON "Delivery"("inningsId", "sourceDeliveryId");

-- A replayed source match is created once, even across process restarts.
DROP INDEX "Match_source_sourceMatchId_idx";
CREATE UNIQUE INDEX "Match_source_sourceMatchId_key" ON "Match"("source", "sourceMatchId");
