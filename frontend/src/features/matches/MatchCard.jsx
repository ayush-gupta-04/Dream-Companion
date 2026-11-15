import { Clock } from 'lucide-react';

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
        className={`match-card group ${match.imageUrl ? 'match-card--with-image' : ''} ${
          isLiveSimulation ? 'match-card--live' : ''
        }`}
        data-status={match.status}
        href={destination}
        onClick={handleClick}
      >
        <div className="match-card-media">
          {match.imageUrl ? (
            <img
              className="match-card-image transition-transform duration-300 group-hover:scale-105"
              src={match.imageUrl}
              alt=""
              loading="lazy"
            />
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
              <Clock className="match-card-clock-icon w-3.5 h-3.5" aria-hidden="true" />
              <time dateTime={match.freshness.updatedAt}>
                {formatUpdatedAt(match.freshness.updatedAt)}
              </time>
            </div>
            <span className="match-card-title">{match.displayName}</span>
          </div>

          <div className="match-card-footer">
            <span className="match-card-action">
              <span>Open match</span>
              <span
                className="match-card-action-arrow transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              >
                →
              </span>
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}
