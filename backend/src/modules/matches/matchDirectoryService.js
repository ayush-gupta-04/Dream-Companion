import { getMatchCardImageUrl } from './matchCardImageService.js';
import { prisma } from '../../db/prisma.js';
import { isLiveMatchId } from '../../replay/liveReplayManager.js';

const statusOrder = {
  LIVE: 0,
  SCHEDULED: 1,
  COMPLETE: 2,
  ABANDONED: 3
};

function toTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function latestActivityAt(match) {
  const deliveryTimestamps = match.innings.flatMap((innings) =>
    innings.deliveries.map((delivery) => delivery.ingestedAt)
  );
  const latestDelivery = deliveryTimestamps.sort(
    (left, right) => toTimestamp(right) - toTimestamp(left)
  )[0];

  return latestDelivery ?? match.updatedAt;
}

function presentMatchCard(match) {
  const updatedAt = latestActivityAt(match);

  return {
    id: match.id,
    displayName: match.name,
    imageUrl: getMatchCardImageUrl(match.id),
    status: match.status,
    isLiveSimulation: isLiveMatchId(match.id),
    freshness: {
      updatedAt: new Date(updatedAt).toISOString()
    }
  };
}

function compareMatchCards(left, right) {
  const statusDifference = statusOrder[left.status] - statusOrder[right.status];
  if (statusDifference !== 0) return statusDifference;

  const freshnessDifference =
    toTimestamp(right.freshness.updatedAt) - toTimestamp(left.freshness.updatedAt);
  if (freshnessDifference !== 0) return freshnessDifference;

  return left.displayName.localeCompare(right.displayName);
}

/**
 * Returns the minimal public contract needed to browse available matches.
 * The latest ingested delivery provides freshness when one exists; otherwise
 * the match metadata timestamp is the only factual update reference.
 */
export async function listMatchCards() {
  const matches = await prisma.match.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
      innings: {
        select: {
          deliveries: {
            orderBy: { ingestedAt: 'desc' },
            take: 1,
            select: { ingestedAt: true }
          }
        }
      }
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    matches: matches.map(presentMatchCard).sort(compareMatchCards)
  };
}
