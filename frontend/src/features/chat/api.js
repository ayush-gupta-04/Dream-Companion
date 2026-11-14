import { ApiError } from '../../services/api.js';

function isQueryResponse(payload) {
  return (
    payload &&
    typeof payload.kind === 'string' &&
    ['ANALYSIS', 'RECAP', 'UNSUPPORTED'].includes(payload.kind) &&
    Array.isArray(payload.references ?? []) &&
    Array.isArray(payload.limitations ?? [])
  );
}

export async function queryMatch(apiClient, matchId, { query, sessionId, signal } = {}) {
  const trimmed = typeof query === 'string' ? query.trim() : '';

  if (trimmed.length < 3) {
    throw new ApiError('Query must be at least 3 characters long.', { status: 400 });
  }

  const body = { query: trimmed };
  if (sessionId) {
    body.sessionId = sessionId;
  }

  const payload = await apiClient.request(`/api/matches/${encodeURIComponent(matchId)}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  if (!isQueryResponse(payload)) {
    throw new ApiError('The match query service returned an unexpected response.', {
      retryable: true
    });
  }

  return payload;
}
