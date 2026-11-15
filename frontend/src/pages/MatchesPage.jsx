import { useMemo } from 'react';
import { useAuth } from '@clerk/react';
import { MatchDirectory } from '../features/matches/index.js';
import { createAuthenticatedApiClient } from '../services/api.js';

export function MatchesPage({ onNavigate }) {
  const { getToken } = useAuth();
  const apiClient = useMemo(() => createAuthenticatedApiClient(getToken), [getToken]);

  return <MatchDirectory apiClient={apiClient} onNavigate={onNavigate} />;
}
