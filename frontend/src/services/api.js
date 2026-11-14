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
        response = await fetch(path, {
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
