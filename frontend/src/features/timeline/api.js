import { ApiError } from '../../services/api.js';

function isTimelineEvent(event) {
  return (
    event &&
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.title === 'string' &&
    typeof event.description === 'string' &&
    event.importance &&
    typeof event.importance.level === 'string' &&
    event.delivery &&
    typeof event.delivery.sequence === 'number'
  );
}

function isTimelineResponse(payload) {
  return (
    payload &&
    Array.isArray(payload.events) &&
    payload.events.every(isTimelineEvent) &&
    (payload.nextCursor === null || typeof payload.nextCursor === 'string' || payload.nextCursor === undefined)
  );
}

export async function listTimelineEvents(apiClient, matchId, options = {}) {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.innings) params.set('innings', String(options.innings));
  if (options.types) {
    const typesStr = Array.isArray(options.types) ? options.types.join(',') : options.types;
    params.set('types', typesStr);
  }

  const queryString = params.toString();
  const path = `/api/matches/${encodeURIComponent(matchId)}/timeline${queryString ? `?${queryString}` : ''}`;

  const payload = await apiClient.request(path, { signal: options.signal });

  if (!isTimelineResponse(payload)) {
    throw new ApiError('The timeline returned an unexpected response.', { retryable: true });
  }

  return {
    events: payload.events,
    nextCursor: payload.nextCursor ?? null
  };
}
