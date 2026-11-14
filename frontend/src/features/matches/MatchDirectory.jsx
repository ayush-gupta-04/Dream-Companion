import { useEffect, useMemo, useState } from 'react';
import { MatchCard } from './MatchCard.jsx';
import {
  MatchDirectoryEmpty,
  MatchDirectoryError,
  MatchDirectoryLoading
} from './MatchDirectoryState.jsx';
import { useMatchDirectory } from './useMatchDirectory.js';
import './matches.css';

const MATCHES_PER_PAGE = 12;

export function MatchDirectory({ apiClient, onNavigate }) {
  const { directory, error, isLoading, isRefreshing, isStale, refresh } =
    useMatchDirectory(apiClient);
  const [page, setPage] = useState(1);
  const matches = directory?.matches ?? [];
  const totalPages = Math.max(1, Math.ceil(matches.length / MATCHES_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visibleMatches = useMemo(() => {
    const firstMatchIndex = (currentPage - 1) * MATCHES_PER_PAGE;
    return matches.slice(firstMatchIndex, firstMatchIndex + MATCHES_PER_PAGE);
  }, [currentPage, matches]);
  const firstVisibleMatch = matches.length === 0 ? 0 : (currentPage - 1) * MATCHES_PER_PAGE + 1;
  const lastVisibleMatch = Math.min(currentPage * MATCHES_PER_PAGE, matches.length);

  useEffect(() => {
    setPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  return (
    <main
      className="directory-page content-width"
      id="main-content"
      aria-labelledby="matches-title"
    >
      <div className="directory-intro">
        <div>
          <p className="eyebrow">Your matches</p>
          <h1 id="matches-title">Choose a match to follow.</h1>
          <p>Live matches appear first. Every listed match is available to explore.</p>
        </div>
        {directory && (
          <button
            className="button button-secondary directory-refresh"
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh matches'}
          </button>
        )}
      </div>

      {isLoading && !directory && <MatchDirectoryLoading />}
      {error && !directory && <MatchDirectoryError error={error} onRefresh={refresh} />}

      {directory && (
        <>
          {isStale && (
            <div className="directory-notice" role="status">
              <p>
                Could not refresh the directory. You are viewing the last loaded match list, which
                may be out of date.
              </p>
              <button className="text-button" type="button" onClick={refresh}>
                Retry
              </button>
            </div>
          )}

          {directory.matches.length === 0 ? (
            <MatchDirectoryEmpty />
          ) : (
            <>
              <p className="directory-pagination-summary" aria-live="polite">
                Showing {firstVisibleMatch}–{lastVisibleMatch} of {matches.length} matches
              </p>
              <ul
                className="match-directory-list"
                aria-label={`Available matches, page ${currentPage} of ${totalPages}`}
              >
                {visibleMatches.map((match) => (
                  <MatchCard key={match.id} match={match} onNavigate={onNavigate} />
                ))}
              </ul>
              {totalPages > 1 && (
                <nav className="directory-pagination" aria-label="Match pages">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setPage((previousPage) => previousPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous matches
                  </button>
                  <span className="directory-page-status" aria-current="page">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setPage((previousPage) => previousPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next matches
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
