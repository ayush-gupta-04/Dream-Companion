export function VideoPlayerPlaceholder({ matchName, status = 'SCHEDULED' }) {
  const isLive = status === 'LIVE';

  return (
    <section
      className="video-placeholder-shell"
      aria-label="Live match video companion placeholder"
    >
      <div className="video-placeholder-aspect">
        <div className="video-placeholder-overlay">
          <div className="video-placeholder-topline">
            <span className="video-badge">
              <span className={`status-dot ${isLive ? 'status-dot--live' : ''}`} aria-hidden="true" />
              <span>{isLive ? 'Live Simulation' : 'Match Simulation'}</span>
            </span>
            {matchName && <span className="video-match-title">{matchName}</span>}
          </div>

          <div className="video-placeholder-center">
            <div className="video-icon-wrapper" aria-hidden="true">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
                <line x1="2" y1="2" x2="22" y2="22" strokeWidth="2" />
              </svg>
            </div>
            <p className="video-placeholder-heading">Video Companion Shell</p>
            <p className="video-placeholder-caption">
              Visual broadcast simulation only. Video playback, seeking, and timeline-to-video
              synchronization are excluded by system design.
            </p>
          </div>

          <div className="video-placeholder-footer">
            <span className="video-footer-pill">
              Factual ball-by-ball intelligence is verified below
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
