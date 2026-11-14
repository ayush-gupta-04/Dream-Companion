const statusLabels = {
  LIVE: 'Live',
  SCHEDULED: 'Scheduled',
  COMPLETE: 'Complete',
  ABANDONED: 'Abandoned'
};

function formatUpdatedAt(value) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Update time unavailable';

  return `Updated ${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(timestamp)}`;
}

function shouldHandleClientNavigation(event) {
  return event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

export function MatchCard({ match, onNavigate }) {
  const destination = `/matches/${encodeURIComponent(match.id)}`;
  const isLiveSimulation = Boolean(match.isLiveSimulation || match.status === 'LIVE');
  const statusLabel = match.isLiveSimulation
    ? 'Live simulation'
    : (statusLabels[match.status] ?? match.status);

  function handleClick(event) {
    if (!shouldHandleClientNavigation(event)) return;
    event.preventDefault();
    onNavigate(destination);
  }

  return (
    <li className="match-card-item">
      <a
        className={`match-card ${match.imageUrl ? 'match-card--with-image' : ''} ${
          isLiveSimulation ? 'match-card--live' : ''
        }`}
        data-status={match.status}
        href={destination}
        onClick={handleClick}
      >
        <div className="match-card-media">
          {match.imageUrl ? (
            <img className="match-card-image" src={match.imageUrl} alt="" loading="lazy" />
          ) : (
            <div className="match-card-media-fallback" aria-hidden="true" />
          )}
          <div className="match-card-media-overlay" aria-hidden="true" />
          <div className="match-card-badge-container">
            <span
              className={`match-status match-status--${
                isLiveSimulation ? 'live' : match.status.toLowerCase()
              }`}
            >
              {isLiveSimulation && <span className="match-status-live-dot" aria-hidden="true" />}
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="match-card-details">
          <div className="match-card-copy">
            <div className="match-card-meta">
              <svg
                className="match-card-clock-icon"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <time dateTime={match.freshness.updatedAt}>
                {formatUpdatedAt(match.freshness.updatedAt)}
              </time>
            </div>
            <span className="match-card-title">{match.displayName}</span>
          </div>

          <div className="match-card-footer">
            <span className="match-card-action">
              <span>Open match</span>
              <span className="match-card-action-arrow" aria-hidden="true">→</span>
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}
