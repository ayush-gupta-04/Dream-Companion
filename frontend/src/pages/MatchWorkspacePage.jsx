import { useMemo } from 'react';
import { useAuth } from '@clerk/react';
import { MatchWorkspace } from '../features/matches/index.js';
import { createAuthenticatedApiClient } from '../services/api.js';

export function MatchWorkspacePage({ matchId, onNavigate }) {
  const { getToken } = useAuth();
  const apiClient = useMemo(() => createAuthenticatedApiClient(getToken), [getToken]);

  return (
    <MatchWorkspace
      apiClient={apiClient}
      matchId={matchId}
      getToken={getToken}
      onNavigate={onNavigate}
    />
  );
}
