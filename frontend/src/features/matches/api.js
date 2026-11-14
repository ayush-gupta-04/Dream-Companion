import { ApiError } from '../../services/api.js';

function isMatchCard(match) {
  return (
    match &&
    typeof match.id === 'string' &&
    typeof match.displayName === 'string' &&
    typeof match.status === 'string' &&
    typeof match.freshness?.updatedAt === 'string'
  );
}

function isMatchDirectory(payload) {
  return (
    payload &&
    typeof payload.generatedAt === 'string' &&
    Array.isArray(payload.matches) &&
    payload.matches.every(isMatchCard)
  );
}

function isMatchStatePayload(payload) {
  return (
    payload &&
    payload.state &&
    typeof payload.state.matchId === 'string' &&
    typeof payload.state.name === 'string' &&
    typeof payload.state.status === 'string' &&
    Array.isArray(payload.state.innings)
  );
}

function isSessionJoinPayload(payload) {
  return payload && payload.session && typeof payload.session.id === 'string';
}

function isLiveSimulationPayload(payload) {
  return payload && payload.simulation && typeof payload.simulation.status === 'string';
}

export async function listMatches(apiClient, options = {}) {
  const payload = await apiClient.request('/api/matches', { signal: options.signal });

  if (!isMatchDirectory(payload)) {
    throw new ApiError('The match directory returned an unexpected response.', { retryable: true });
  }

  return payload;
}

export async function getMatchState(apiClient, matchId, options = {}) {
  const payload = await apiClient.request(`/api/matches/${encodeURIComponent(matchId)}/state`, {
    signal: options.signal
  });

  if (!isMatchStatePayload(payload)) {
    throw new ApiError('The match state returned an unexpected response.', { retryable: true });
  }

  return payload.state;
}

export async function startLiveSimulation(apiClient, matchId, options = {}) {
  const payload = await apiClient.request(
    `/api/matches/${encodeURIComponent(matchId)}/live-simulation`,
    {
      method: 'POST',
      signal: options.signal
    }
  );

  if (!isLiveSimulationPayload(payload)) {
    throw new ApiError('The live simulation returned an unexpected response.', { retryable: true });
  }

  return payload.simulation;
}

export async function joinMatchSession(apiClient, matchId, options = {}) {
  const payload = await apiClient.request(
    `/api/matches/${encodeURIComponent(matchId)}/sessions/join`,
    {
      method: 'POST',
      signal: options.signal
    }
  );

  if (!isSessionJoinPayload(payload)) {
    throw new ApiError('Unable to establish a viewer session for this match.', { retryable: true });
  }

  return payload.session;
}

export async function leaveMatchSession(apiClient, matchId, sessionId, options = {}) {
  if (!sessionId) return null;

  return apiClient.request(`/api/matches/${encodeURIComponent(matchId)}/sessions/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
    signal: options.signal
  });
}
