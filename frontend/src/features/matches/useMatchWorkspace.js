import { useCallback, useEffect, useRef, useState } from 'react';
import { getMatchState, joinMatchSession, leaveMatchSession, startLiveSimulation } from './api.js';

export function useMatchWorkspace(apiClient, matchId, matchSocket) {
  const [state, setState] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [error, setError] = useState(null);
  const [liveSimulationError, setLiveSimulationError] = useState(null);

  const activeSessionIdRef = useRef(null);
  const isMountedRef = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  const loadState = useCallback(
    async ({ isRefresh = false, keepLoading = false } = {}) => {
      if (!apiClient || !matchId) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
        setError(null);
      }

      try {
        const nextState = await getMatchState(apiClient, matchId);
        if (!isMountedRef.current) return;

        setState(nextState);
        setIsStale(false);
        setError(null);
        return nextState;
      } catch (err) {
        if (!isMountedRef.current) return;

        if (stateRef.current !== null && err?.retryable) {
          setIsStale(true);
        } else {
          setError(err);
        }
        return null;
      } finally {
        if (isMountedRef.current && !keepLoading) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [apiClient, matchId]
  );

  useEffect(() => {
    isMountedRef.current = true;
    setLiveSimulationError(null);
    let isCancelled = false;

    async function initializeWorkspace() {
      try {
        let nextState = await loadState({ keepLoading: true });

        // The backend alone decides whether this is the one replayable match.
        // Starting is intentionally invisible to fans: they only see the
        // familiar live state and realtime updates.
        if (nextState?.isLiveSimulation && !isCancelled) {
          try {
            await startLiveSimulation(apiClient, matchId);
            nextState = await loadState({ keepLoading: true });
            setLiveSimulationError(null);
          } catch (simulationError) {
            if (!isCancelled && isMountedRef.current) {
              setLiveSimulationError(simulationError);
            }
          }
        }

        if (nextState && !isCancelled) {
          const newSession = await joinMatchSession(apiClient, matchId);
          if (!isCancelled && isMountedRef.current) {
            setSession(newSession);
            activeSessionIdRef.current = newSession?.id;
          } else if (newSession?.id) {
            leaveMatchSession(apiClient, matchId, newSession.id).catch(() => {});
          }
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    initializeWorkspace().catch(() => {});

    return () => {
      isCancelled = true;
      isMountedRef.current = false;
      const currentSessionId = activeSessionIdRef.current;
      activeSessionIdRef.current = null;
      if (currentSessionId) {
        leaveMatchSession(apiClient, matchId, currentSessionId).catch(() => {});
      }
    };
  }, [apiClient, matchId]);

  // Realtime Socket.IO subscriptions for score and status updates
  useEffect(() => {
    if (!matchSocket || isLoading) return;

    function handleScoreUpdated(nextState) {
      if (nextState && (!nextState.matchId || nextState.matchId === matchId)) {
        setState(nextState);
        setIsStale(false);
      }
    }

    function handleStatusUpdated({ matchId: updatedId, status }) {
      if (!updatedId || updatedId === matchId) {
        setState((prev) => (prev ? { ...prev, status } : prev));
      }
    }

    function handleConnect() {
      setIsSocketConnected(true);
      loadState({ isRefresh: true });
    }

    function handleDisconnect() {
      setIsSocketConnected(false);
    }

    matchSocket.on('score_updated', handleScoreUpdated);
    matchSocket.on('match_status_updated', handleStatusUpdated);
    matchSocket.on('connect', handleConnect);
    matchSocket.on('disconnect', handleDisconnect);

    // Initial socket status check if already connected
    if (matchSocket.socket?.connected) {
      handleConnect();
    }

    return () => {
      matchSocket.off('score_updated', handleScoreUpdated);
      matchSocket.off('match_status_updated', handleStatusUpdated);
      matchSocket.off('connect', handleConnect);
      matchSocket.off('disconnect', handleDisconnect);
    };
  }, [loadState, matchSocket, isLoading, matchId]);

  const refresh = useCallback(() => {
    return loadState({ isRefresh: true });
  }, [loadState]);

  return {
    state,
    session,
    isLoading,
    isRefreshing,
    isStale,
    isSocketConnected,
    error,
    liveSimulationError,
    refresh
  };
}
