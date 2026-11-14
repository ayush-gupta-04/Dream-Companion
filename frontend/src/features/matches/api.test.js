import { describe, expect, it, vi } from 'vitest';
import {
  getMatchState,
  joinMatchSession,
  leaveMatchSession,
  listMatches,
  startLiveSimulation
} from './api.js';

describe('matches API adapter', () => {
  it('validates and returns match directory payload', async () => {
    const apiClient = {
      request: vi.fn().mockResolvedValue({
        generatedAt: '2026-11-14T12:00:00.000Z',
        matches: [
          {
            id: 'm1',
            displayName: 'Team A v Team B',
            status: 'LIVE',
            freshness: { updatedAt: '2026-11-14T12:00:00.000Z' }
          }
        ]
      })
    };

    const result = await listMatches(apiClient);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe('m1');
  });

  it('rejects an invalid match directory structure', async () => {
    const apiClient = { request: vi.fn().mockResolvedValue({ invalid: 'payload' }) };

    await expect(listMatches(apiClient)).rejects.toMatchObject({
      name: 'ApiError',
      retryable: true,
      message: 'The match directory returned an unexpected response.'
    });
  });

  it('validates and extracts state from getMatchState', async () => {
    const mockState = {
      matchId: 'match-123',
      name: 'India v Australia',
      status: 'LIVE',
      ballsPerOver: 6,
      currentInnings: null,
      innings: [],
      updatedAt: '2026-11-14T12:00:00.000Z'
    };
    const apiClient = { request: vi.fn().mockResolvedValue({ state: mockState }) };

    const result = await getMatchState(apiClient, 'match-123');
    expect(apiClient.request).toHaveBeenCalledWith('/api/matches/match-123/state', {
      signal: undefined
    });
    expect(result).toEqual(mockState);
  });

  it('rejects an invalid match state payload', async () => {
    const apiClient = { request: vi.fn().mockResolvedValue({ state: null }) };

    await expect(getMatchState(apiClient, 'match-123')).rejects.toMatchObject({
      name: 'ApiError',
      retryable: true,
      message: 'The match state returned an unexpected response.'
    });
  });

  it('starts the configured live simulation without accepting replay controls from the browser', async () => {
    const apiClient = {
      request: vi.fn().mockResolvedValue({
        simulation: { status: 'started', matchId: 'match-123' }
      })
    };

    await expect(startLiveSimulation(apiClient, 'match-123')).resolves.toEqual({
      status: 'started',
      matchId: 'match-123'
    });
    expect(apiClient.request).toHaveBeenCalledWith('/api/matches/match-123/live-simulation', {
      method: 'POST',
      signal: undefined
    });
  });

  it('validates and extracts session from joinMatchSession', async () => {
    const mockSession = {
      id: 'session-abc-123',
      matchId: 'match-123',
      joinedAt: '2026-11-14T12:00:00.000Z',
      marker: { inningsNumber: 1, deliverySequence: 5 }
    };
    const apiClient = { request: vi.fn().mockResolvedValue({ session: mockSession }) };

    const result = await joinMatchSession(apiClient, 'match-123');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/matches/match-123/sessions/join',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toEqual(mockSession);
  });

  it('rejects an invalid session join response', async () => {
    const apiClient = { request: vi.fn().mockResolvedValue({}) };

    await expect(joinMatchSession(apiClient, 'match-123')).rejects.toMatchObject({
      name: 'ApiError',
      retryable: true,
      message: 'Unable to establish a viewer session for this match.'
    });
  });

  it('sends leave request with sessionId and handles empty/null sessionId gracefully', async () => {
    const apiClient = { request: vi.fn().mockResolvedValue(null) };

    const emptyResult = await leaveMatchSession(apiClient, 'match-123', null);
    expect(emptyResult).toBeNull();
    expect(apiClient.request).not.toHaveBeenCalled();

    await leaveMatchSession(apiClient, 'match-123', 'session-123');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/matches/match-123/sessions/leave',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sessionId: 'session-123' })
      })
    );
  });
});
