import { SignInButton } from '@clerk/react';

export function MatchWorkspaceSkeleton() {
  return (
    <div className="workspace-loading" aria-busy="true" aria-label="Loading match workspace">
      <div className="workspace-skeleton-header">
        <span className="skeleton-pill" style={{ width: '6rem' }} />
        <span className="skeleton-title" style={{ width: '18rem', height: '2rem' }} />
      </div>

      <div className="workspace-grid">
        <div className="skeleton-video-stage" />
        <div className="skeleton-state-card">
          <div className="skeleton-pill" style={{ width: '8rem', marginBottom: '1rem' }} />
          <div className="skeleton-score" />
          <div className="skeleton-rows">
            <span className="skeleton-row" />
            <span className="skeleton-row" />
            <span className="skeleton-row" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StaleDataNotice({ onRefresh, isRefreshing = false }) {
  return (
    <aside className="directory-notice workspace-stale-notice" role="status">
      <p>
        <strong>Connection issue:</strong> Match state could not be updated and may be out of date.
        Showing verified cached figures.
      </p>
      <button
        type="button"
        className="text-button"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? 'Retrying…' : 'Refresh now'}
      </button>
    </aside>
  );
}

export function MatchWorkspaceError({ error, onRetry, onNavigate }) {
  const status = error?.status;

  if (status === 401) {
    return (
      <section className="directory-state workspace-state-error" aria-labelledby="error-title">
        <p className="eyebrow">Session expired</p>
        <h2 id="error-title">Your session has expired</h2>
        <p>Sign in again to continue viewing this match.</p>
        <SignInButton>
          <button type="button" className="button button-primary">
            Sign in
          </button>
        </SignInButton>
      </section>
    );
  }

  if (status === 404) {
    return (
      <section className="directory-state workspace-state-error" aria-labelledby="error-title">
        <p className="eyebrow">Not found</p>
        <h2 id="error-title">Match not found</h2>
        <p>The requested match does not exist or may have been removed.</p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => onNavigate('/matches')}
        >
          Return to matches
        </button>
      </section>
    );
  }

  if (status === 403) {
    return (
      <section className="directory-state workspace-state-error" aria-labelledby="error-title">
        <p className="eyebrow">Access denied</p>
        <h2 id="error-title">Match access is unavailable</h2>
        <p>You do not have permission to view this match workspace.</p>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => onNavigate('/matches')}
        >
          Return to matches
        </button>
      </section>
    );
  }

  if (status === 503) {
    return (
      <section className="directory-state workspace-state-error" aria-labelledby="error-title">
        <p className="eyebrow">Service unavailable</p>
        <h2 id="error-title">Match service is not configured</h2>
        <p>The match intelligence service is temporarily unavailable. Please check back later.</p>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => onNavigate('/matches')}
        >
          Return to matches
        </button>
      </section>
    );
  }

  return (
    <section className="directory-state workspace-state-error" aria-labelledby="error-title">
      <p className="eyebrow">Connection failure</p>
      <h2 id="error-title">Match workspace could not be loaded</h2>
      <p>{error?.message || 'Unable to connect to the match service. Please try again.'}</p>
      <div className="state-actions">
        {onRetry && (
          <button type="button" className="button button-primary" onClick={onRetry}>
            Try again
          </button>
        )}
        <button
          type="button"
          className="button button-secondary"
          onClick={() => onNavigate('/matches')}
        >
          Return to matches
        </button>
      </div>
    </section>
  );
}
