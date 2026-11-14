import { round } from './math.js';

export const BOWLER_WICKET_KINDS = new Set([
  'bowled',
  'caught',
  'caught and bowled',
  'hit wicket',
  'lbw',
  'stumped'
]);

export const EMPTY_EXTRAS = Object.freeze({
  wides: 0,
  noBalls: 0,
  byes: 0,
  legByes: 0,
  penaltyRuns: 0
});

/**
 * Formats a count of legal deliveries into standard cricket over notation (e.g. 16.3).
 *
 * @param {number} legalDeliveries Number of legal balls bowled.
 * @param {number} [ballsPerOver=6] Balls per legal over.
 * @returns {string} Formatted over string.
 */
export function formatOvers(legalDeliveries, ballsPerOver = 6) {
  return `${Math.floor(legalDeliveries / ballsPerOver)}.${legalDeliveries % ballsPerOver}`;
}

/**
 * Determines whether a wicket dismissal counts as a bowler's wicket.
 * Excludes run outs, retired hurt, obstructing the field, etc.
 *
 * @param {{ kind: string, countsAsWicket?: boolean }} wicket
 * @returns {boolean}
 */
export function isBowlerWicket(wicket) {
  return Boolean(wicket?.countsAsWicket && BOWLER_WICKET_KINDS.has(wicket.kind.toLowerCase()));
}

/**
 * Calculates the run rate given runs and legal deliveries bowled.
 *
 * @param {number} runs
 * @param {number} legalDeliveries
 * @param {number} [ballsPerOver=6]
 * @returns {number}
 */
export function calculateRunRate(runs, legalDeliveries, ballsPerOver = 6) {
  if (legalDeliveries === 0) return 0;
  return round((runs * ballsPerOver) / legalDeliveries, 2);
}

/**
 * Calculates bowler economy rate.
 *
 * @param {number} runsConceded
 * @param {number} legalDeliveries
 * @param {number} [ballsPerOver=6]
 * @returns {number}
 */
export function calculateEconomy(runsConceded, legalDeliveries, ballsPerOver = 6) {
  if (legalDeliveries === 0) return 0;
  return round((runsConceded * ballsPerOver) / legalDeliveries, 2);
}

/**
 * Calculates batter strike rate ((runs / ballsFaced) * 100).
 *
 * @param {number} runs
 * @param {number} ballsFaced
 * @returns {number}
 */
export function calculateStrikeRate(runs, ballsFaced) {
  if (ballsFaced === 0) return 0;
  return round((runs / ballsFaced) * 100, 2);
}
