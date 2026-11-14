import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/api.js';
import { MatchWorkspace } from './MatchWorkspace.jsx';

const getMatchStateMock = vi.hoisted(() => vi.fn());
const joinMatchSessionMock = vi.hoisted(() => vi.fn());
const leaveMatchSessionMock = vi.hoisted(() => vi.fn());
const startLiveSimulationMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }) => children
}));

vi.mock('./api.js', () => ({
  getMatchState: getMatchStateMock,
  joinMatchSession: joinMatchSessionMock,
  leaveMatchSession: leaveMatchSessionMock,
  startLiveSimulation: startLiveSimulationMock
}));

const mockLiveMatchState = {
  matchId: 'match-101',
  name: 'India vs Australia',
  status: 'LIVE',
  ballsPerOver: 6,
  currentInnings: {
    id: 'inn-1',
    inningsNumber: 1,
    battingTeam: 'India',
    targetRuns: null,
    state: {
      totalRuns: 142,
      wickets: 3,
      legalDeliveries: 94,
      overs: '15.4',
      ballsPerOver: 6,
      extras: {
        wides: 4,
        noBalls: 1,
        byes: 0,
        legByes: 2,
        penaltyRuns: 0
      },
      batters: {
        'V Kohli': {
          runs: 52,
          ballsFaced: 34,
          fours: 4,
          sixes: 2,
          strikeRate: 152.9
        },
        'KL Rahul': {
          runs: 18,
          ballsFaced: 14,
          fours: 1,
          sixes: 1,
          strikeRate: 128.6
        }
      },
      bowlers: {
        'P Cummins': {
          legalDeliveries: 22,
          overs: '3.4',
          runsConceded: 28,
          wickets: 2,
          economy: 7.64
        }
      }
    }
  },
  innings: [],
  updatedAt: '2026-11-14T12:00:00.000Z'
};

const mockSession = {
  id: 'session-xyz-987',
  matchId: 'match-101',
  joinedAt: '2026-11-14T12:00:00.000Z',
  marker: {
    inningsNumber: 1,
    deliverySequence: 94
  }
};

describe('MatchWorkspace', () => {
  beforeEach(() => {
    getMatchStateMock.mockReset();
    joinMatchSessionMock.mockReset();
    leaveMatchSessionMock.mockReset();
    startLiveSimulationMock.mockReset();

    joinMatchSessionMock.mockResolvedValue(mockSession);
    leaveMatchSessionMock.mockResolvedValue(null);
    startLiveSimulationMock.mockResolvedValue({ status: 'started', matchId: 'match-101' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an accessible loading skeleton before match state resolves', () => {
    getMatchStateMock.mockReturnValue(new Promise(() => {}));

    render(<MatchWorkspace apiClient={{}} matchId="match-101" onNavigate={vi.fn()} />);

    expect(screen.getByLabelText('Loading match workspace')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders factual match state without calculating figures in the browser', async () => {
    getMatchStateMock.mockResolvedValue(mockLiveMatchState);

    render(<MatchWorkspace apiClient={{}} matchId="match-101" onNavigate={vi.fn()} />);

    // Match Header
    expect(await screen.findByRole('heading', { name: 'India vs Australia' })).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();

    // Innings context
    expect(screen.getByText('India')).toBeInTheDocument();
    expect(screen.getByText('1st Innings')).toBeInTheDocument();

    // Primary score display
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('15.4 ov')).toBeInTheDocument();

    // Extras
    expect(screen.getByText(/Extras: 7/)).toBeInTheDocument();

    // Batters table
    expect(screen.getByText('V Kohli')).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();
    expect(screen.getByText('152.9')).toBeInTheDocument();

    expect(screen.getByText('KL Rahul')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();

    // Bowlers table
    expect(screen.getByText('P Cummins')).toBeInTheDocument();
    expect(screen.getByText('3.4')).toBeInTheDocument();
    expect(screen.getByText('7.64')).toBeInTheDocument();
  });

  it('toggles the detailed scorecard when clicking the collapse trigger', async () => {
    getMatchStateMock.mockResolvedValue(mockLiveMatchState);
    const user = userEvent.setup();

    render(<MatchWorkspace apiClient={{}} matchId="match-101" onNavigate={vi.fn()} />);

    expect(await screen.findByText('V Kohli')).toBeInTheDocument();
    const toggleButton = screen.getByRole('button', { name: /Collapse scorecard/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggleButton);
    expect(screen.queryByText('V Kohli')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expand scorecard/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('15.4 ov')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Expand scorecard/i }));
    expect(await screen.findByText('V Kohli')).toBeInTheDocument();
  });

  it('renders a clearly labelled, non-playing video placeholder shell without media controls', async () => {
    getMatchStateMock.mockResolvedValue(mockLiveMatchState);

    render(<MatchWorkspace apiClient={{}} matchId="match-101" onNavigate={vi.fn()} />);

    const placeholder = await screen.findByLabelText('Live match video companion placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(screen.getByText('Video Companion Shell')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Video playback, seeking, and timeline-to-video synchronization are excluded/
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Live Simulation')).toBeInTheDocument();

    // Assert strictly that no playable video or seek controls are rendered
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('audio')).toBeNull();
    expect(document.querySelector('input[type="range"]')).toBeNull();
  });

  it('establishes a viewer session on mount and leaves the session on unmount', async () => {
    getMatchStateMock.mockResolvedValue(mockLiveMatchState);
    const mockClient = { token: 'test-token' };

    const { unmount } = render(
      <MatchWorkspace apiClient={mockClient} matchId="match-101" onNavigate={vi.fn()} />
    );

    await screen.findByRole('heading', { name: 'India vs Australia' });

    expect(joinMatchSessionMock).toHaveBeenCalledWith(mockClient, 'match-101');

    unmount();

    expect(leaveMatchSessionMock).toHaveBeenCalledWith(mockClient, 'match-101', 'session-xyz-987');
  });

  it('automatically starts only the backend-designated live simulation before joining', async () => {
    const simulationState = { ...mockLiveMatchState, isLiveSimulation: true };
    getMatchStateMock.mockResolvedValue(simulationState);
    const mockClient = { token: 'test-token' };

    render(<MatchWorkspace apiClient={mockClient} matchId="match-101" onNavigate={vi.fn()} />);

    await screen.findByRole('heading', { name: 'India vs Australia' });

    expect(startLiveSimulationMock).toHaveBeenCalledWith(mockClient, 'match-101');
    expect(joinMatchSessionMock).toHaveBeenCalledWith(mockClient, 'match-101');
    expect(getMatchStateMock).toHaveBeenCalledTimes(2);
  });

  it('navigates back to match directory when clicking "All matches"', async () => {
    getMatchStateMock.mockResolvedValue(mockLiveMatchState);
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(<MatchWorkspace apiClient={{}} matchId="match-101" onNavigate={onNavigate} />);

    const backLink = await screen.findByRole('link', { name: /All matches/i });
    await user.click(backLink);

    expect(onNavigate).toHaveBeenCalledWith('/matches');
  });

  it('displays a dedicated 404 state when match is not found', async () => {
    getMatchStateMock.mockRejectedValue(new ApiError('Match not found', { status: 404 }));
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(<MatchWorkspace apiClient={{}} matchId="non-existent" onNavigate={onNavigate} />);

    expect(await screen.findByRole('heading', { name: 'Match not found' })).toBeInTheDocument();
    const returnBtn = screen.getByRole('button', { name: 'Return to matches' });
    await user.click(returnBtn);
    expect(onNavigate).toHaveBeenCalledWith('/matches');
  });

  it('displays a 401 session-expired state with a sign-in action', async () => {
    getMatchStateMock.mockRejectedValue(new ApiError('Session expired', { status: 401 }));

    render(<MatchWorkspace apiClient={{}} matchId="match-101" onNavigate={vi.fn()} />);

    expect(
      await screen.findByRole('heading', { name: 'Your session has expired' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('offers a retry action on retryable service failure', async () => {
    getMatchStateMock.mockRejectedValue(
      new ApiError('Service unavailable', { status: 500, retryable: true })
    );

    render(<MatchWorkspace apiClient={{}} matchId="match-101" onNavigate={vi.fn()} />);

    expect(
      await screen.findByRole('heading', { name: 'Match workspace could not be loaded' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('retains last-known state with an accessible stale warning on failed refresh', async () => {
    getMatchStateMock
      .mockResolvedValueOnce(mockLiveMatchState)
      .mockRejectedValueOnce(
        new ApiError('Network timeout during refresh', { status: 504, retryable: true })
      );

    const user = userEvent.setup();

    render(<MatchWorkspace apiClient={{}} matchId="match-101" onNavigate={vi.fn()} />);

    // Initial load succeeded
    await screen.findByRole('heading', { name: 'India vs Australia' });
    expect(screen.getByText('142')).toBeInTheDocument();

    // Trigger manual refresh
    const refreshBtn = screen.getByRole('button', { name: 'Refresh match state' });
    await user.click(refreshBtn);

    // Verified that existing data is retained and stale warning is rendered
    expect(await screen.findByRole('status')).toHaveTextContent('may be out of date');
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('V Kohli')).toBeInTheDocument();
  });

  it('updates compact match state in real time on score_updated socket event', async () => {
    getMatchStateMock.mockResolvedValue(mockLiveMatchState);
    const socketHandlers = {};
    const mockSocket = {
      connect: vi.fn(),
      joinMatch: vi.fn(),
      on: vi.fn((event, fn) => {
        socketHandlers[event] = fn;
      }),
      off: vi.fn((event) => {
        delete socketHandlers[event];
      })
    };

    render(
      <MatchWorkspace
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
        onNavigate={vi.fn()}
      />
    );

    // Initial state rendered
    await screen.findByRole('heading', { name: 'India vs Australia' });
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('15.4 ov')).toBeInTheDocument();

    // Verify socket connected and joined match room after load
    expect(mockSocket.connect).toHaveBeenCalled();
    expect(mockSocket.joinMatch).toHaveBeenCalledWith('match-101');

    // Simulate score_updated socket event
    const updatedState = {
      ...mockLiveMatchState,
      currentInnings: {
        ...mockLiveMatchState.currentInnings,
        state: {
          ...mockLiveMatchState.currentInnings.state,
          totalRuns: 148,
          wickets: 3,
          overs: '16.0'
        }
      }
    };

    await act(async () => {
      socketHandlers.score_updated(updatedState);
    });

    expect(screen.getByText('148')).toBeInTheDocument();
    expect(screen.getByText('16.0 ov')).toBeInTheDocument();
    expect(getMatchStateMock).toHaveBeenCalledTimes(1);
    expect(mockSocket.off).not.toHaveBeenCalled();
  });

  it('does not re-register socket listeners or re-fetch state when score_updated arrives while connected', async () => {
    getMatchStateMock.mockResolvedValue(mockLiveMatchState);
    const socketHandlers = {};
    const mockSocket = {
      socket: { connected: true },
      connect: vi.fn(),
      joinMatch: vi.fn(),
      on: vi.fn((event, fn) => {
        socketHandlers[event] = fn;
      }),
      off: vi.fn((event) => {
        delete socketHandlers[event];
      })
    };

    render(
      <MatchWorkspace
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
        onNavigate={vi.fn()}
      />
    );

    await screen.findByRole('heading', { name: 'India vs Australia' });
    const initialOnCallCount = mockSocket.on.mock.calls.length;

    // Simulate score_updated socket event
    const updatedState = {
      ...mockLiveMatchState,
      currentInnings: {
        ...mockLiveMatchState.currentInnings,
        state: {
          ...mockLiveMatchState.currentInnings.state,
          totalRuns: 155,
          wickets: 3,
          overs: '17.0'
        }
      }
    };

    await act(async () => {
      socketHandlers.score_updated(updatedState);
    });

    expect(screen.getByText('155')).toBeInTheDocument();
    expect(mockSocket.on.mock.calls.length).toBe(initialOnCallCount);
    expect(mockSocket.off).not.toHaveBeenCalled();
    expect(getMatchStateMock.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('reconciles current state after a socket connection is established', async () => {
    const socketHandlers = {};
    const reconciledState = {
      ...mockLiveMatchState,
      currentInnings: {
        ...mockLiveMatchState.currentInnings,
        state: {
          ...mockLiveMatchState.currentInnings.state,
          totalRuns: 149,
          overs: '16.1'
        }
      }
    };
    const mockSocket = {
      connect: vi.fn(),
      joinMatch: vi.fn(),
      on: vi.fn((event, fn) => {
        socketHandlers[event] = fn;
      }),
      off: vi.fn((event) => {
        delete socketHandlers[event];
      })
    };
    getMatchStateMock
      .mockResolvedValueOnce(mockLiveMatchState)
      .mockResolvedValueOnce(reconciledState);

    render(
      <MatchWorkspace
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
        onNavigate={vi.fn()}
      />
    );

    await screen.findByRole('heading', { name: 'India vs Australia' });

    await act(async () => {
      await socketHandlers.connect();
    });

    expect(await screen.findByText('149')).toBeInTheDocument();
    expect(screen.getByText('16.1 ov')).toBeInTheDocument();
    expect(getMatchStateMock).toHaveBeenCalledTimes(2);
  });

  it('updates match status in real time on match_status_updated socket event', async () => {
    getMatchStateMock.mockResolvedValue(mockLiveMatchState);
    const socketHandlers = {};
    const mockSocket = {
      connect: vi.fn(),
      joinMatch: vi.fn(),
      on: vi.fn((event, fn) => {
        socketHandlers[event] = fn;
      }),
      off: vi.fn((event) => {
        delete socketHandlers[event];
      })
    };

    render(
      <MatchWorkspace
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
        onNavigate={vi.fn()}
      />
    );

    await screen.findByRole('heading', { name: 'India vs Australia' });
    expect(screen.getByText('LIVE')).toBeInTheDocument();

    await act(async () => {
      socketHandlers.match_status_updated({ matchId: 'match-101', status: 'COMPLETE' });
    });

    expect(screen.getByText('COMPLETE')).toBeInTheDocument();
  });
});
