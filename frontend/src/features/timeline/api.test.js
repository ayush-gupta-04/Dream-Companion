import { describe, expect, it, vi } from 'vitest';
import { listTimelineEvents } from './api.js';

describe('timeline API adapter', () => {
  const mockEvent = {
    id: 'evt-1',
    matchId: 'match-1',
    innings: { id: 'inn-1', number: 1 },
    delivery: {
      id: 'del-1',
      sequence: 1,
      display: { overNumber: 0, ballLabel: '0.1' }
    },
    type: 'FOUR',
    title: 'Four by V Kohli',
    description: 'V Kohli hit four at 0.1.',
    importance: { score: 40, level: 'MINOR' },
    occurredAt: '2026-11-14T12:00:00.000Z'
  };

  it('validates and extracts events and nextCursor', async () => {
    const apiClient = {
      request: vi.fn().mockResolvedValue({
        events: [mockEvent],
        nextCursor: 'evt-1'
      })
    };

    const result = await listTimelineEvents(apiClient, 'match-1');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/matches/match-1/timeline',
      expect.objectContaining({ signal: undefined })
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe('evt-1');
    expect(result.nextCursor).toBe('evt-1');
  });

  it('passes pagination and filter options in query string', async () => {
    const apiClient = {
      request: vi.fn().mockResolvedValue({
        events: [mockEvent],
        nextCursor: null
      })
    };

    await listTimelineEvents(apiClient, 'match-1', {
      cursor: 'cursor-123',
      limit: 10,
      innings: 2,
      types: ['WICKET', 'FOUR']
    });

    expect(apiClient.request).toHaveBeenCalledWith(
      expect.stringContaining('cursor=cursor-123'),
      expect.anything()
    );
    expect(apiClient.request).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.anything()
    );
    expect(apiClient.request).toHaveBeenCalledWith(
      expect.stringContaining('innings=2'),
      expect.anything()
    );
    expect(apiClient.request).toHaveBeenCalledWith(
      expect.stringContaining('types=WICKET%2CFOUR'),
      expect.anything()
    );
  });

  it('rejects an invalid timeline payload structure', async () => {
    const apiClient = {
      request: vi.fn().mockResolvedValue({ invalid: 'payload' })
    };

    await expect(listTimelineEvents(apiClient, 'match-1')).rejects.toMatchObject({
      name: 'ApiError',
      retryable: true,
      message: 'The timeline returned an unexpected response.'
    });
  });
});
