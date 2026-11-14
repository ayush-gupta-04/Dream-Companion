/**
 * @typedef {object} PlayerIdentity
 * @property {string} id Internal player ID.
 * @property {string} displayName Display name of the player.
 * @property {string} [source] External provider name (e.g. 'cricsheet').
 * @property {string} [sourcePlayerId] External provider player ID or registry ID.
 * @property {Record<string, unknown>} [metadata] Optional provider-specific metadata.
 */

/**
 * @typedef {object} TeamIdentity
 * @property {string} id Internal team ID.
 * @property {string} name Full team name.
 * @property {string} [shortName] Abbreviated team name.
 * @property {string} [source] External provider name.
 * @property {string} [sourceTeamId] External provider team ID.
 */

/**
 * @typedef {object} NormalizedMatch
 * @property {string} id Internal match ID.
 * @property {string} name Match name or description.
 * @property {'SCHEDULED' | 'LIVE' | 'COMPLETE' | 'ABANDONED'} status Match progress status.
 * @property {number} ballsPerOver Number of legal deliveries per over (default 6).
 * @property {Date} [startedAt] Match scheduled or actual start timestamp.
 * @property {{ provider: string, matchId?: string, revision?: string }} [source] Provider reference.
 */

/**
 * @typedef {object} NormalizedInnings
 * @property {string} id Internal innings ID.
 * @property {string} matchId Internal match ID.
 * @property {number} inningsNumber One-based innings number (e.g. 1 or 2).
 * @property {string} battingTeamId Batting team ID.
 * @property {'PENDING' | 'IN_PROGRESS' | 'COMPLETE'} status Innings status.
 * @property {number} [targetRuns] Target runs for second-innings chases.
 * @property {number} [prePenaltyRuns] Penalty runs awarded before the innings.
 * @property {number} [postPenaltyRuns] Penalty runs awarded after the innings.
 * @property {string} [sourceInningsId] Provider innings identifier.
 */

/**
 * @typedef {object} NormalizedDelivery
 * @property {number} deliverySequence Internal, one-based ordering within an innings.
 * @property {{ overNumber: number, ballLabel: string }} display Provider display values only.
 * @property {{ batterId: string, nonStrikerId: string, bowlerId: string }} players Internal player IDs.
 * @property {{ batter: number, total: number }} runs Runs credited to the batter and team.
 * @property {{ wides: number, noBalls: number, byes: number, legByes: number, penaltyRuns: number }} extras
 * @property {boolean} isLegalDelivery Derived from wide and no-ball extras.
 * @property {Array<{ playerOutId: string, kind: string, countsAsWicket: boolean, fielders: string[] }>} wickets
 * @property {{ provider: string, deliveryId?: string, revision?: string } | undefined} source
 * @property {Date | undefined} occurredAt
 * @property {unknown} rawPayload
 */

/**
 * @typedef {object} InningsState
 * @property {number} totalRuns
 * @property {number} wickets
 * @property {number} legalDeliveries
 * @property {string} overs
 * @property {number} [ballsPerOver]
 * @property {{ wides: number, noBalls: number, byes: number, legByes: number, penaltyRuns: number }} extras
 * @property {Record<string, { runs: number, ballsFaced: number, fours: number, sixes: number, strikeRate: number }>} batters
 * @property {Record<string, { legalDeliveries: number, overs: string, runsConceded: number, wickets: number, economy: number }>} bowlers
 */

export {};
