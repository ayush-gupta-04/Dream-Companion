import { SignInButton } from '@clerk/react';

function errorContent(error) {
  switch (error?.status) {
    case 401:
      return {
        title: 'Your session has expired',
        description: 'Sign in again to continue to your matches.',
        action: 'sign-in'
      };
    case 403:
      return {
        title: 'Match access is unavailable',
        description: 'This account is not allowed to view the match directory.',
        action: 'home'
      };
    case 503:
      return {
        title: 'Match access is not configured',
        description: 'Authentication is not ready on the match service. Please try again later.',
        action: 'home'
      };
    default:
      return {
        title: 'Matches could not be loaded',
        description: error?.message || 'Please check your connection and try again.',
        action: 'retry'
      };
  }
}

export function MatchDirectoryLoading() {
  return (
    <section className="directory-loading" aria-busy="true" aria-label="Loading matches">
      {[1, 2, 3].map((item) => (
        <div className="match-skeleton" key={item}>
          <span />
          <span />
        </div>
      ))}
    </section>
  );
}

export function MatchDirectoryEmpty() {
  return (
    <section className="directory-state" aria-labelledby="empty-matches-title">
      <p className="eyebrow">No matches available</p>
      <h2 id="empty-matches-title">There are no matches to follow yet.</h2>
      <p>When a replay is available, it will appear here.</p>
    </section>
  );
}

export function MatchDirectoryError({ error, onRefresh }) {
  const content = errorContent(error);

  return (
    <section className="directory-state" role="alert" aria-labelledby="directory-error-title">
      <p className="eyebrow">Match directory</p>
      <h2 id="directory-error-title">{content.title}</h2>
      <p>{content.description}</p>
      {content.action === 'sign-in' && (
        <SignInButton>
          <button className="button button-primary" type="button">
            Sign in again
          </button>
        </SignInButton>
      )}
      {content.action === 'retry' && (
        <button className="button button-primary" type="button" onClick={onRefresh}>
          Try again
        </button>
      )}
      {content.action === 'home' && (
        <a className="button button-secondary" href="/">
          Return home
        </a>
      )}
    </section>
  );
}
