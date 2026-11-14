import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createAuthenticatedApiClient } from './api.js';

describe('createAuthenticatedApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gets a fresh token and sends it as a Bearer token for each request', async () => {
    const getToken = vi.fn().mockResolvedValue('fresh-clerk-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ matches: [] })
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createAuthenticatedApiClient(getToken);
    await client.request('/api/matches');
    await client.request('/api/matches');

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/matches', {
      headers: { Authorization: 'Bearer fresh-clerk-token' }
    });
  });

  it('preserves HTTP error status for safe UI states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Authentication is not configured.' })
      })
    );

    const client = createAuthenticatedApiClient(vi.fn().mockResolvedValue('fresh-clerk-token'));

    await expect(client.request('/api/matches')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      retryable: true,
      message: 'Authentication is not configured.'
    });
  });

  it('marks network failures as retryable without fabricating an HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failed')));
    const client = createAuthenticatedApiClient(vi.fn().mockResolvedValue('fresh-clerk-token'));

    await expect(client.request('/api/matches')).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        status: null,
        retryable: true
      })
    );
  });

  it('rejects a missing Clerk token as a session-expired error', async () => {
    const client = createAuthenticatedApiClient(vi.fn().mockResolvedValue(null));

    await expect(client.request('/api/matches')).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        status: 401,
        retryable: false
      })
    );
    expect(ApiError).toBeTypeOf('function');
  });
});
