import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/api.js';
import { MatchDirectory } from './MatchDirectory.jsx';
import { MatchWorkspaceShell } from './MatchWorkspaceShell.jsx';

const listMatchesMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }) => children
}));

vi.mock('./api.js', () => ({
  listMatches: listMatchesMock,
  getMatchState: vi.fn().mockResolvedValue(null),
  joinMatchSession: vi.fn().mockResolvedValue(null),
  leaveMatchSession: vi.fn().mockResolvedValue(null),
  startLiveSimulation: vi.fn().mockResolvedValue({ status: 'started' })
}));

function directoryResponse(matches) {
  return {
    generatedAt: '2026-11-14T12:00:00.000Z',
    matches
  };
}

const matches = [
  {
    id: 'live-match',
    displayName: 'Australia v Sri Lanka',
    imageUrl: '/match-card-images/img1.jpg',
    status: 'LIVE',
    isLiveSimulation: true,
    freshness: { updatedAt: '2026-11-14T11:59:00.000Z' }
  },
  {
    id: 'complete-match',
    displayName: 'India v England',
    imageUrl: '/match-card-images/img2.jpg',
    status: 'COMPLETE',
    isLiveSimulation: false,
    freshness: { updatedAt: '2026-11-14T10:00:00.000Z' }
  }
];

const paginatedMatches = Array.from({ length: 13 }, (_, index) => ({
  id: `match-${index + 1}`,
  displayName: `Match ${index + 1}`,
  imageUrl: `/match-card-images/img${(index % 12) + 1}.jpg`,
  status: 'COMPLETE',
  isLiveSimulation: false,
  freshness: { updatedAt: '2026-11-14T10:00:00.000Z' }
}));

describe('MatchDirectory', () => {
  beforeEach(() => {
    listMatchesMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows an accessible loading state before the directory resolves', () => {
    listMatchesMock.mockReturnValue(new Promise(() => {}));

    render(<MatchDirectory apiClient={{}} onNavigate={vi.fn()} />);

    expect(screen.getByLabelText('Loading matches')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders all returned matches and highlights only LIVE cards', async () => {
    listMatchesMock.mockResolvedValue(directoryResponse(matches));
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(<MatchDirectory apiClient={{}} onNavigate={onNavigate} />);

    const liveLink = await screen.findByRole('link', { name: /Australia v Sri Lanka/i });
    expect(liveLink).toHaveClass('match-card--live');
    expect(liveLink.querySelector('img')).toHaveAttribute('src', '/match-card-images/img1.jpg');
    expect(screen.getByRole('link', { name: /India v England/i })).not.toHaveClass(
      'match-card--live'
    );

    await user.click(liveLink);
    expect(onNavigate).toHaveBeenCalledWith('/matches/live-match');
  });

  it('explains an empty directory and allows a retry', async () => {
    listMatchesMock.mockResolvedValue(directoryResponse([]));

    render(<MatchDirectory apiClient={{}} onNavigate={vi.fn()} />);

    expect(
      await screen.findByRole('heading', { name: 'There are no matches to follow yet.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh matches' })).toBeInTheDocument();
  });

  it('paginates match cards without changing the directory request contract', async () => {
    listMatchesMock.mockResolvedValue(directoryResponse(paginatedMatches));
    const user = userEvent.setup();

    render(<MatchDirectory apiClient={{}} onNavigate={vi.fn()} />);

    await screen.findByText('Match 1');
    expect(screen.getByText('Showing 1–12 of 13 matches')).toBeInTheDocument();
    expect(screen.queryByText('Match 13')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous matches' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next matches' }));

    expect(screen.getByText('Showing 13–13 of 13 matches')).toBeInTheDocument();
    expect(screen.getByText('Match 13')).toBeInTheDocument();
    expect(screen.queryByText('Match 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next matches' })).toBeDisabled();
  });

  it.each([
    [401, 'Your session has expired'],
    [403, 'Match access is unavailable'],
    [503, 'Match access is not configured']
  ])('renders a specific %i match-access state', async (status, title) => {
    listMatchesMock.mockRejectedValue(new ApiError('Request failed', { status }));

    render(<MatchDirectory apiClient={{}} onNavigate={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('offers a retry for a retryable match-service failure', async () => {
    listMatchesMock.mockRejectedValue(
      new ApiError('Unable to reach the match service.', { retryable: true })
    );

    render(<MatchDirectory apiClient={{}} onNavigate={vi.fn()} />);

    expect(
      await screen.findByRole('heading', { name: 'Matches could not be loaded' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('retains last-known data with a stale notice after a retryable refresh failure', async () => {
    listMatchesMock
      .mockResolvedValueOnce(directoryResponse(matches))
      .mockRejectedValueOnce(
        new ApiError('The service is unavailable.', { status: 500, retryable: true })
      );
    const user = userEvent.setup();

    render(<MatchDirectory apiClient={{}} onNavigate={vi.fn()} />);

    await screen.findByRole('link', { name: /Australia v Sri Lanka/i });
    await user.click(screen.getByRole('button', { name: 'Refresh matches' }));

    expect(await screen.findByRole('status')).toHaveTextContent('may be out of date');
    expect(screen.getByRole('link', { name: /Australia v Sri Lanka/i })).toBeInTheDocument();
  });
});

describe('MatchWorkspaceShell', () => {
  afterEach(() => {
    cleanup();
  });

  it('provides a clear path back to the match directory', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<MatchWorkspaceShell onNavigate={onNavigate} />);

    await user.click(screen.getByRole('link', { name: 'All matches' }));
    expect(onNavigate).toHaveBeenCalledWith('/matches');
  });
});
