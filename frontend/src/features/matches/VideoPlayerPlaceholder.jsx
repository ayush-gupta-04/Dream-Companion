import { VideoOff, ShieldCheck } from 'lucide-react';

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
              <span
                className={`status-dot ${isLive ? 'status-dot--live' : ''}`}
                aria-hidden="true"
              />
              <span>{isLive ? 'Live Simulation' : 'Match Simulation'}</span>
            </span>
            {matchName && <span className="video-match-title">{matchName}</span>}
          </div>

          <div className="video-placeholder-center">
            <div className="video-icon-wrapper" aria-hidden="true">
              <VideoOff className="w-8 h-8 text-slate-400" />
            </div>
            <p className="video-placeholder-heading">Video Companion Shell</p>
            <p className="video-placeholder-caption">
              Visual broadcast simulation only. Video playback, seeking, and timeline-to-video
              synchronization are excluded by system design.
            </p>
          </div>

          <div className="video-placeholder-footer">
            <span className="video-footer-pill inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              Factual ball-by-ball intelligence is verified below
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
