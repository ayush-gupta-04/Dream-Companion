import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createAuthenticatedApiClient, resolveApiUrl } from './api.js';

describe('createAuthenticatedApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

  it('prepends VITE_API_URL when configured and avoids duplicated /api prefix', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.dreamcompanion.com/api/');
    const getToken = vi.fn().mockResolvedValue('fresh-clerk-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ matches: [] })
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createAuthenticatedApiClient(getToken);
    await client.request('/api/matches');

    expect(fetchMock).toHaveBeenCalledWith('https://api.dreamcompanion.com/api/matches', {
      headers: { Authorization: 'Bearer fresh-clerk-token' }
    });
  });
});

describe('resolveApiUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns relative path when VITE_API_URL is unset', () => {
    expect(resolveApiUrl('/api/matches')).toBe('/api/matches');
  });

  it('resolves against VITE_API_URL without trailing slash', () => {
    vi.stubEnv('VITE_API_URL', 'https://backend.onrender.com');
    expect(resolveApiUrl('/api/matches')).toBe('https://backend.onrender.com/api/matches');
    expect(resolveApiUrl('api/matches')).toBe('https://backend.onrender.com/api/matches');
  });

  it('handles trailing slashes and avoids duplicate /api segments', () => {
    vi.stubEnv('VITE_API_URL', 'https://backend.onrender.com/api/');
    expect(resolveApiUrl('/api/matches')).toBe('https://backend.onrender.com/api/matches');
  });

  it('leaves full URLs untouched', () => {
    vi.stubEnv('VITE_API_URL', 'https://backend.onrender.com');
    expect(resolveApiUrl('https://other-service.com/webhook')).toBe('https://other-service.com/webhook');
  });
});
