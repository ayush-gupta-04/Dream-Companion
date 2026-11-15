import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { createMatchSocket } from '../../services/socket.js';
import { MatchCompanionChat } from '../chat/MatchCompanionChat.jsx';
import { SmartMatchTimeline } from '../timeline/SmartMatchTimeline.jsx';
import { MatchStateCard } from './MatchStateCard.jsx';
import {
  MatchWorkspaceError,
  MatchWorkspaceSkeleton,
  StaleDataNotice
} from './MatchWorkspaceState.jsx';
import { VideoPlayerPlaceholder } from './VideoPlayerPlaceholder.jsx';
import { useMatchWorkspace } from './useMatchWorkspace.js';

export function MatchWorkspace({
  apiClient,
  matchId,
  getToken,
  matchSocket: propSocket,
  onNavigate
}) {
  const [internalSocket, setInternalSocket] = useState(null);
  const [authError, setAuthError] = useState(null);

  // Initialize socket controller if getToken is provided and no propSocket was injected
  useEffect(() => {
    if (propSocket) return;
    if (!getToken) return;

    const socketInstance = createMatchSocket({
      getToken,
      onAuthError: (err) => setAuthError(err)
    });

    setInternalSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [getToken, propSocket]);

  const activeSocket = propSocket || internalSocket;

  const {
    state,
    session,
    isLoading,
    isRefreshing,
    isStale,
    isSocketConnected,
    error,
    liveSimulationError,
    refresh
  } = useMatchWorkspace(apiClient, matchId, activeSocket);

  // Connect Socket.IO ONLY AFTER initial state is loaded per Roadmap Phase 7.4
  useEffect(() => {
    if (activeSocket && !isLoading && matchId) {
      activeSocket.joinMatch(matchId);
      activeSocket.connect();
    }
  }, [activeSocket, isLoading, matchId]);

  function handleBack(event) {
    event.preventDefault();
    onNavigate('/matches');
  }

  const isLive = state?.status === 'LIVE';

  return (
    <main
      className="workspace-shell content-width"
      id="main-content"
      aria-labelledby="workspace-title"
    >
      <nav className="workspace-nav" aria-label="Workspace navigation">
        <a
          className="back-link inline-flex items-center gap-2"
          href="/matches"
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> All matches
        </a>
      </nav>

      {isLoading ? (
        <MatchWorkspaceSkeleton />
      ) : error && !state ? (
        <MatchWorkspaceError error={error} onRetry={refresh} onNavigate={onNavigate} />
      ) : (
        <>
          <header className="workspace-header">
            <div className="workspace-header-info">
              <p className="eyebrow">Match workspace</p>
              <h1 id="workspace-title">{state?.name || 'Match Companion'}</h1>
            </div>

            <div className="workspace-header-actions">
              <button
                type="button"
                className="button button-secondary workspace-refresh-button inline-flex items-center gap-1.5"
                onClick={refresh}
                disabled={isRefreshing}
                aria-label="Refresh match state"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
              </button>
            </div>
          </header>

          {isStale && <StaleDataNotice onRefresh={refresh} isRefreshing={isRefreshing} />}

          {authError && (
            <aside className="directory-notice workspace-stale-notice" role="alert">
              <p>
                <strong>Authentication needed:</strong> Live updates paused due to an expired
                session. Please sign in again to resume realtime streaming.
              </p>
            </aside>
          )}

          {liveSimulationError && (
            <aside className="directory-notice workspace-stale-notice" role="alert">
              <p>
                <strong>Live updates unavailable:</strong> {liveSimulationError.message}
              </p>
            </aside>
          )}

          {/* Full-width Video Playback Shell Hero */}
          <section className="workspace-video-hero" aria-label="Match video player area">
            <VideoPlayerPlaceholder matchName={state?.name} status={state?.status} />
          </section>

          {/* Dual-column panels for Match State & Smart Timeline */}
          <div className="workspace-grid workspace-panels-grid">
            <div className="workspace-state-column">
              <MatchStateCard state={state} />
            </div>

            <div className="workspace-timeline-column">
              <SmartMatchTimeline
                apiClient={apiClient}
                matchId={matchId}
                matchSocket={activeSocket}
                isLive={isLive}
                isSocketConnected={isSocketConnected}
              />
            </div>
          </div>

          <MatchCompanionChat apiClient={apiClient} matchId={matchId} sessionId={session?.id} />
        </>
      )}
    </main>
  );
}

// Re-export for backwards compatibility
export const MatchWorkspaceShell = MatchWorkspace;
