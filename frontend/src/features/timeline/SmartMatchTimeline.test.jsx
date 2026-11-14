import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SmartMatchTimeline } from './SmartMatchTimeline.jsx';

const listTimelineEventsMock = vi.hoisted(() => vi.fn());

vi.mock('./api.js', () => ({
  listTimelineEvents: listTimelineEventsMock
}));

const mockEvent1 = {
  id: 'evt-1',
  matchId: 'match-101',
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

const mockEvent2 = {
  id: 'evt-2',
  matchId: 'match-101',
  innings: { id: 'inn-1', number: 1 },
  delivery: {
    id: 'del-2',
    sequence: 4,
    display: { overNumber: 0, ballLabel: '0.4' }
  },
  type: 'WICKET',
  title: 'Wicket — Rohit Sharma',
  description: 'Rohit Sharma was dismissed caught at 0.4.',
  importance: { score: 90, level: 'MAJOR' },
  occurredAt: '2026-11-14T12:02:00.000Z'
};

const mockEvent3 = {
  id: 'evt-3',
  matchId: 'match-101',
  innings: { id: 'inn-1', number: 1 },
  delivery: {
    id: 'del-3',
    sequence: 6,
    display: { overNumber: 0, ballLabel: '0.6' }
  },
  type: 'SIX',
  title: 'Six by KL Rahul',
  description: 'KL Rahul hit six at 0.6.',
  importance: { score: 70, level: 'HIGHLIGHT' },
  occurredAt: '2026-11-14T12:04:00.000Z'
};

describe('SmartMatchTimeline', () => {
  let socketHandlers = {};
  let mockSocket;

  beforeEach(() => {
    listTimelineEventsMock.mockReset();
    socketHandlers = {};
    mockSocket = {
      on: vi.fn((event, handler) => {
        socketHandlers[event] = handler;
      }),
      off: vi.fn((event) => {
        delete socketHandlers[event];
      })
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an accessible loading skeleton before timeline resolves', () => {
    listTimelineEventsMock.mockReturnValue(new Promise(() => {}));

    render(
      <SmartMatchTimeline
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
      />
    );

    expect(screen.getByLabelText('Loading match timeline')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders factual event cards with types, over reference, title, and importance', async () => {
    listTimelineEventsMock.mockResolvedValue({
      events: [mockEvent1, mockEvent2],
      nextCursor: null
    });

    render(
      <SmartMatchTimeline
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
      />
    );

    expect(await screen.findByText('Four by V Kohli')).toBeInTheDocument();
    expect(screen.getByText('Wicket — Rohit Sharma')).toBeInTheDocument();
    expect(screen.getByText('Four')).toBeInTheDocument();
    expect(screen.getByText('Wicket')).toBeInTheDocument();
    expect(screen.getByText('MAJOR')).toBeInTheDocument();
    expect(screen.getByText('Inn 1 • Ov 0.1')).toBeInTheDocument();
    expect(screen.getByText('Inn 1 • Ov 0.4')).toBeInTheDocument();
  });

  it('shows an empty state when no key moments have been recorded', async () => {
    listTimelineEventsMock.mockResolvedValue({
      events: [],
      nextCursor: null
    });

    render(
      <SmartMatchTimeline
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
      />
    );

    expect(await screen.findByText('No key moments recorded yet.')).toBeInTheDocument();
  });

  it('reconciles new events in deterministic order rather than packet arrival order', async () => {
    listTimelineEventsMock.mockResolvedValue({
      events: [mockEvent1, mockEvent3], // sequence 1 and sequence 6
      nextCursor: null
    });

    render(
      <SmartMatchTimeline
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
      />
    );

    await screen.findByText('Four by V Kohli');

    // Simulate socket event for sequence 4 arriving LATER
    expect(socketHandlers.timeline_event_created).toBeDefined();
    await act(async () => {
      socketHandlers.timeline_event_created(mockEvent2); // sequence 4
    });

    // The cards in DOM should be strictly ordered: sequence 1, sequence 4, sequence 6
    const titles = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(titles).toEqual(['Four by V Kohli', 'Wicket — Rohit Sharma', 'Six by KL Rahul']);
  });

  it('reconciles in-place updates and deletions from provider corrections', async () => {
    listTimelineEventsMock.mockResolvedValue({
      events: [mockEvent1, mockEvent2],
      nextCursor: null
    });

    render(
      <SmartMatchTimeline
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
      />
    );

    await screen.findByText('Four by V Kohli');

    // In-place update
    const updatedEvent1 = {
      ...mockEvent1,
      title: 'Corrected Four by V Kohli',
      description: 'Corrected delivery description.'
    };
    await act(async () => {
      socketHandlers.timeline_event_updated(updatedEvent1);
    });

    expect(await screen.findByText('Corrected Four by V Kohli')).toBeInTheDocument();
    expect(screen.queryByText('Four by V Kohli')).not.toBeInTheDocument();

    // Provider correction / event deletion
    await act(async () => {
      socketHandlers.timeline_event_deleted({ id: 'evt-2' });
    });

    expect(screen.queryByText('Wicket — Rohit Sharma')).not.toBeInTheDocument();
  });

  it('filters events by type when clicking filter pills', async () => {
    listTimelineEventsMock.mockResolvedValue({
      events: [mockEvent1, mockEvent2, mockEvent3],
      nextCursor: null
    });
    const user = userEvent.setup();

    render(
      <SmartMatchTimeline
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
      />
    );

    await screen.findByText('Four by V Kohli');

    // Click Wickets filter
    await user.click(screen.getByRole('button', { name: 'Wickets' }));
    expect(screen.getByText('Wicket — Rohit Sharma')).toBeInTheDocument();
    expect(screen.queryByText('Four by V Kohli')).not.toBeInTheDocument();
    expect(screen.queryByText('Six by KL Rahul')).not.toBeInTheDocument();

    // Click Boundaries filter
    await user.click(screen.getByRole('button', { name: 'Boundaries' }));
    expect(screen.getByText('Four by V Kohli')).toBeInTheDocument();
    expect(screen.getByText('Six by KL Rahul')).toBeInTheDocument();
    expect(screen.queryByText('Wicket — Rohit Sharma')).not.toBeInTheDocument();
  });

  it('supports cursor pagination via load earlier moments button', async () => {
    listTimelineEventsMock.mockResolvedValueOnce({
      events: [mockEvent1],
      nextCursor: 'cursor-token-1'
    });
    const user = userEvent.setup();

    render(
      <SmartMatchTimeline
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
      />
    );

    await screen.findByText('Four by V Kohli');
    const loadMoreBtn = screen.getByRole('button', { name: 'Load earlier moments' });
    expect(loadMoreBtn).toBeInTheDocument();

    listTimelineEventsMock.mockResolvedValueOnce({
      events: [mockEvent2],
      nextCursor: null
    });

    await user.click(loadMoreBtn);

    expect(listTimelineEventsMock).toHaveBeenCalledWith(
      expect.anything(),
      'match-101',
      expect.objectContaining({ cursor: 'cursor-token-1' })
    );
    expect(await screen.findByText('Wicket — Rohit Sharma')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load earlier moments' })).not.toBeInTheDocument();
  });

  it('toggles selection for in-app question context without seeking video', async () => {
    listTimelineEventsMock.mockResolvedValue({
      events: [mockEvent1],
      nextCursor: null
    });
    const user = userEvent.setup();

    render(
      <SmartMatchTimeline
        apiClient={{}}
        matchId="match-101"
        matchSocket={mockSocket}
      />
    );

    const card = await screen.findByRole('button', { name: /Four by V Kohli/i });
    expect(card).toHaveAttribute('aria-pressed', 'false');

    await user.click(card);
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('✓ Context selected for companion')).toBeInTheDocument();

    // Confirm that no video seek or media actions were triggered
    expect(document.querySelector('video')).toBeNull();
  });
});
