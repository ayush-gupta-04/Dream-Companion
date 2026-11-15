import { useState } from 'react';
import { ChevronDown, ShieldCheck, Target, Trophy, Activity } from 'lucide-react';

function formatOrdinal(number) {
  if (number === 1) return '1st';
  if (number === 2) return '2nd';
  if (number === 3) return '3rd';
  return `${number}th`;
}

function formatFreshness(timestamp) {
  if (!timestamp) return 'Time unavailable';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'Time unavailable';
  }
}

export function MatchStateCard({ state, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!state) {
    return (
      <article
        className="match-state-card match-state-card--empty"
        aria-label="Match state unavailable"
      >
        <p className="state-empty-label">Match state is currently unavailable.</p>
      </article>
    );
  }

  const { name, status, currentInnings, updatedAt } = state;
  const inningsState = currentInnings?.state;
  const isLive = status === 'LIVE';

  const battersList = inningsState?.batters ? Object.entries(inningsState.batters) : [];
  const bowlersList = inningsState?.bowlers ? Object.entries(inningsState.bowlers) : [];

  const extras = inningsState?.extras || {};
  const totalExtras =
    (extras.wides ?? 0) +
    (extras.noBalls ?? 0) +
    (extras.byes ?? 0) +
    (extras.legByes ?? 0) +
    (extras.penaltyRuns ?? 0);

  return (
    <article
      className={`match-state-card ${isLive ? 'match-state-card--live' : ''} ${
        !isExpanded ? 'match-state-card--collapsed' : ''
      }`}
      aria-label="Current match state"
    >
      <header className="state-header">
        <div className="state-header-top">
          <div className="state-team-group">
            <span className="state-team-badge inline-flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              {currentInnings ? `${currentInnings.battingTeam}` : name}
            </span>
            {currentInnings && (
              <span className="state-innings-pill">
                <Activity className="w-3 h-3 text-emerald-600 mr-1 shrink-0" aria-hidden="true" />
                {formatOrdinal(currentInnings.inningsNumber)} Innings
              </span>
            )}
          </div>
          <div className="state-header-badges">
            <span className={`match-status match-status--${status?.toLowerCase()}`}>
              {isLive && <span className="match-status-live-dot" aria-hidden="true" />}
              {status}
            </span>
          </div>
        </div>

        {currentInnings && currentInnings.targetRuns != null && (
          <div className="state-target-banner">
            <span className="state-target-pill">
              <Target
                className="w-3.5 h-3.5 text-amber-600 inline mr-1 shrink-0"
                aria-hidden="true"
              />
              Target: {currentInnings.targetRuns}
            </span>
          </div>
        )}
      </header>

      {currentInnings && inningsState ? (
        <div className="state-body">
          <div className="score-hero">
            <div
              className="score-numbers"
              aria-label={`${inningsState.totalRuns} runs for ${inningsState.wickets} wickets in ${inningsState.overs} overs`}
            >
              <span className="score-runs">{inningsState.totalRuns}</span>
              <span className="score-divider">/</span>
              <span className="score-wickets">{inningsState.wickets}</span>
            </div>
            <div className="score-meta">
              <span className="score-overs">{inningsState.overs} ov</span>
              <span className="score-balls-per-over">({inningsState.ballsPerOver || 6} b/ov)</span>
            </div>
          </div>

          <button
            type="button"
            className="state-collapse-trigger"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-controls="state-detailed-content"
          >
            <span className="state-collapse-label inline-flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm"
                aria-hidden="true"
              />
              {isExpanded ? 'Collapse scorecard' : 'Expand scorecard'}
            </span>
            <ChevronDown
              className={`state-collapse-chevron w-4 h-4 transition-transform duration-200 ${
                isExpanded ? 'rotate-180 state-collapse-chevron--open' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {isExpanded && (
            <div id="state-detailed-content" className="state-detailed-content">
              <div className="extras-breakdown" aria-label="Extras breakdown">
                <span className="extras-total">Extras: {totalExtras}</span>
                <span className="extras-detail">
                  (w {extras.wides ?? 0}, nb {extras.noBalls ?? 0}, b {extras.byes ?? 0}, lb{' '}
                  {extras.legByes ?? 0}
                  {(extras.penaltyRuns ?? 0) > 0 ? `, pen ${extras.penaltyRuns}` : ''})
                </span>
              </div>

              <section className="state-stats-section" aria-label="Batting summary">
                <div className="stats-section-header">
                  <h3 className="stats-section-title">Batting</h3>
                </div>
                {battersList.length > 0 ? (
                  <div className="table-responsive">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th scope="col" className="table-cell-left">
                            Batter
                          </th>
                          <th scope="col" className="table-cell-right">
                            R
                          </th>
                          <th scope="col" className="table-cell-right">
                            B
                          </th>
                          <th scope="col" className="table-cell-right">
                            4s
                          </th>
                          <th scope="col" className="table-cell-right">
                            6s
                          </th>
                          <th scope="col" className="table-cell-right">
                            SR
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {battersList.map(([id, stats]) => (
                          <tr key={id}>
                            <td className="table-cell-left stats-player-name">{id}</td>
                            <td className="table-cell-right font-tabular font-bold">
                              {stats.runs}
                            </td>
                            <td className="table-cell-right font-tabular">{stats.ballsFaced}</td>
                            <td className="table-cell-right font-tabular">{stats.fours}</td>
                            <td className="table-cell-right font-tabular">{stats.sixes}</td>
                            <td className="table-cell-right font-tabular">
                              {typeof stats.strikeRate === 'number'
                                ? stats.strikeRate.toFixed(1)
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="stats-empty-note">No batting figures recorded yet.</p>
                )}
              </section>

              <section className="state-stats-section" aria-label="Bowling summary">
                <div className="stats-section-header">
                  <h3 className="stats-section-title">Bowling</h3>
                </div>
                {bowlersList.length > 0 ? (
                  <div className="table-responsive">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th scope="col" className="table-cell-left">
                            Bowler
                          </th>
                          <th scope="col" className="table-cell-right">
                            O
                          </th>
                          <th scope="col" className="table-cell-right">
                            R
                          </th>
                          <th scope="col" className="table-cell-right">
                            W
                          </th>
                          <th scope="col" className="table-cell-right">
                            ECON
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bowlersList.map(([id, stats]) => (
                          <tr key={id}>
                            <td className="table-cell-left stats-player-name">{id}</td>
                            <td className="table-cell-right font-tabular">{stats.overs}</td>
                            <td className="table-cell-right font-tabular">{stats.runsConceded}</td>
                            <td className="table-cell-right font-tabular font-bold">
                              {stats.wickets}
                            </td>
                            <td className="table-cell-right font-tabular">
                              {typeof stats.economy === 'number' ? stats.economy.toFixed(2) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="stats-empty-note">No bowling figures recorded yet.</p>
                )}
              </section>
            </div>
          )}
        </div>
      ) : (
        <div className="state-empty-innings">
          <p>No active innings recorded for this match yet.</p>
        </div>
      )}

      <footer className="state-footer">
        <span className="state-freshness">Last verified at {formatFreshness(updatedAt)}</span>
        <span className="state-grounding-tag inline-flex items-center gap-1.5">
          <ShieldCheck className="state-grounding-icon w-3.5 h-3.5" aria-hidden="true" />
          Deterministic match facts
        </span>
      </footer>
    </article>
  );
}
