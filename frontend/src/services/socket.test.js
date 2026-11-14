import { describe, expect, it, vi } from 'vitest';
import { createMatchSocket } from './socket.js';

const mockSocketInstance = vi.hoisted(() => {
  const handlers = {};
  return {
    handlers,
    connected: false,
    auth: {},
    connect: vi.fn(function () {
      mockSocketInstance.connected = true;
    }),
    disconnect: vi.fn(function () {
      mockSocketInstance.connected = false;
    }),
    emit: vi.fn(),
    on: vi.fn((event, fn) => {
      handlers[event] = fn;
    }),
    off: vi.fn((event) => {
      delete handlers[event];
    })
  };
});

vi.mock('socket.io-client', () => ({
  io: vi.fn((url, options) => {
    if (typeof options?.auth === 'function') {
      options.auth((data) => {
        mockSocketInstance.auth = data;
      });
    }
    return mockSocketInstance;
  })
}));

describe('createMatchSocket', () => {
  it('acquires token and connects to socket', async () => {
    const getToken = vi.fn().mockResolvedValue('test-clerk-token');
    const controller = createMatchSocket({ getToken });

    controller.connect();
    expect(mockSocketInstance.connect).toHaveBeenCalled();

    // Simulate successful connection
    mockSocketInstance.handlers.connect();

    controller.joinMatch('match-123');
    expect(mockSocketInstance.emit).toHaveBeenCalledWith('join_match', 'match-123', expect.any(Function));
  });

  it('refreshes token once on auth error before halting reconnect', async () => {
    let callCount = 0;
    const getToken = vi.fn().mockImplementation(async () => {
      callCount += 1;
      return callCount === 1 ? 'initial-token' : 'refreshed-token';
    });
    const onAuthError = vi.fn();

    const controller = createMatchSocket({ getToken, onAuthError });
    controller.connect();

    // Simulate first auth error
    const authError = new Error('Authentication is required.');
    await mockSocketInstance.handlers.connect_error(authError);

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(mockSocketInstance.auth).toEqual({ token: 'refreshed-token' });

    // Simulate second auth error after token refresh
    await mockSocketInstance.handlers.connect_error(authError);

    expect(mockSocketInstance.disconnect).toHaveBeenCalled();
    expect(onAuthError).toHaveBeenCalledWith(authError);
  });
});
