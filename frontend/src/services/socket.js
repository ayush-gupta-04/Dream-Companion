import { io } from 'socket.io-client';

function defaultSocketUrl() {
  return import.meta.env.VITE_SOCKET_URL?.trim() || window.location.origin;
}

/**
 * Creates and manages an authenticated Socket.IO connection for a match room.
 *
 * Implements one-time token refresh on authentication rejection before halting
 * reconnection to prevent infinite reconnection loops per Roadmap Phase 7.4.
 *
 * @param {Object} options
 * @param {string} [options.url] Backend server URL (defaults to window.location.origin)
 * @param {() => Promise<string|null>} options.getToken Function providing a fresh Clerk session token
 * @param {(error: Error) => void} [options.onAuthError] Callback triggered when authentication fails repeatedly
 * @returns {Object} Socket controller with joinMatch, on, off, and disconnect
 */
export function createMatchSocket({
  url = defaultSocketUrl(),
  getToken,
  onAuthError = () => {}
} = {}) {
  let hasRetriedAuth = false;
  let currentMatchId = null;

  const socket = io(url, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: async (cb) => {
      try {
        const token = await getToken();
        cb({ token });
      } catch {
        cb({ token: null });
      }
    }
  });

  socket.on('connect_error', async (err) => {
    const isAuthError =
      err?.message?.includes('Authentication is required') ||
      err?.message?.includes('jwt') ||
      err?.data?.status === 401;

    if (isAuthError) {
      if (!hasRetriedAuth) {
        hasRetriedAuth = true;
        try {
          const freshToken = await getToken();
          if (freshToken) {
            socket.auth = { token: freshToken };
            socket.connect();
            return;
          }
        } catch {
          // Token reacquisition failed
        }
      }

      // Already retried or failed to acquire token: stop reconnecting and inform caller
      socket.disconnect();
      onAuthError(err);
    }
  });

  socket.on('connect', () => {
    hasRetriedAuth = false;
    if (currentMatchId) {
      socket.emit('join_match', currentMatchId);
    }
  });

  return {
    socket,
    connect() {
      if (!socket.connected) {
        socket.connect();
      }
      return this;
    },
    joinMatch(matchId, callback = () => {}) {
      currentMatchId = matchId;
      if (socket.connected) {
        socket.emit('join_match', matchId, callback);
      }
      return this;
    },
    on(event, handler) {
      socket.on(event, handler);
      return this;
    },
    off(event, handler) {
      socket.off(event, handler);
      return this;
    },
    disconnect() {
      currentMatchId = null;
      socket.disconnect();
    }
  };
}
