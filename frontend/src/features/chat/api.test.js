import { describe, expect, it, vi } from 'vitest';
import { queryMatch } from './api.js';

describe('chat API adapter', () => {
  it('validates query length before calling backend', async () => {
    const apiClient = { request: vi.fn() };

    await expect(queryMatch(apiClient, 'match-1', { query: 'hi' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Query must be at least 3 characters long.'
    });
    expect(apiClient.request).not.toHaveBeenCalled();
  });

  it('submits query with sessionId and returns validated payload', async () => {
    const mockResponse = {
      kind: 'ANALYSIS',
      tool: 'OVER_ANALYSIS',
      answer: {
        headline: 'Over Analysis',
        body: '8 runs conceded in the over.',
        bullets: []
      },
      evidence: {},
      references: [{ type: 'DELIVERY', ballLabel: '0.1' }],
      limitations: []
    };

    const apiClient = { request: vi.fn().mockResolvedValue(mockResponse) };

    const result = await queryMatch(apiClient, 'match-1', {
      query: 'Analyse the last over',
      sessionId: 'session-123'
    });

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/matches/match-1/query',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query: 'Analyse the last over',
          sessionId: 'session-123'
        })
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('rejects an invalid response kind', async () => {
    const apiClient = {
      request: vi.fn().mockResolvedValue({ kind: 'INVALID_KIND' })
    };

    await expect(
      queryMatch(apiClient, 'match-1', { query: 'Summarize the match' })
    ).rejects.toMatchObject({
      name: 'ApiError',
      retryable: true,
      message: 'The match query service returned an unexpected response.'
    });
  });
});
