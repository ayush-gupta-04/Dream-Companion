export class ApiError extends Error {
  constructor(message, { status = null, retryable = false, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function messageFromResponse(body, status) {
  if (typeof body?.message === 'string' && body.message.trim()) return body.message;
  return `API request failed with status: ${status}`;
}

export function resolveApiUrl(path) {
  if (typeof path !== 'string' || /^https?:\/\//i.test(path)) {
    return path;
  }

  const base = import.meta.env.VITE_API_URL?.trim();
  if (!base) {
    return path;
  }

  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;

  if (trimmedBase.endsWith('/api') && trimmedPath.startsWith('/api/')) {
    return `${trimmedBase}${trimmedPath.slice(4)}`;
  }

  return `${trimmedBase}${trimmedPath}`;
}

/**
 * Builds the only client used for protected API calls. The token is acquired
 * at request time so Clerk can refresh an expiring session before a request.
 */
export function createAuthenticatedApiClient(getToken) {
  return {
    async request(path, options = {}) {
      const token = await getToken();
      if (!token) {
        throw new ApiError('Your session has expired. Please sign in again.', { status: 401 });
      }

      let response;
      try {
        const url = resolveApiUrl(path);
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`
          }
        });
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        throw new ApiError('Unable to reach the match service. Please try again.', {
          retryable: true,
          cause: error
        });
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(messageFromResponse(body, response.status), {
          status: response.status,
          retryable: isRetryableStatus(response.status)
        });
      }

      return response.status === 204 ? null : response.json();
    }
  };
}
