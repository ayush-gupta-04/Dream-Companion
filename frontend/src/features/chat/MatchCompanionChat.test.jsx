import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCompanionChat } from './MatchCompanionChat.jsx';

const queryMatchMock = vi.hoisted(() => vi.fn());

vi.mock('./api.js', () => ({
  queryMatch: queryMatchMock
}));

const mockAnalysisResponse = {
  kind: 'ANALYSIS',
  tool: 'OVER_ANALYSIS',
  answer: '### Tidy Over by Cummins\n\nOnly 3 runs conceded with 4 dot balls.',
  evidence: {},
  references: [{ type: 'DELIVERY', ballLabel: '15.4', overNumber: 15 }],
  limitations: []
};

const mockRecapResponse = {
  kind: 'RECAP',
  tool: 'LAST_OVER',
  answer:
    '### Over 16 Summary\n\nIndia accelerated scoring in this over.\n\n* V Kohli hit boundary off ball 2\n* Single on ball 5\n* Dot ball on ball 6',
  evidence: {},
  references: [{ type: 'DELIVERY', ballLabel: '16.2' }],
  limitations: []
};

const mockUnsupportedResponse = {
  kind: 'UNSUPPORTED',
  tool: 'UNSUPPORTED',
  answer: null,
  evidence: null,
  references: [],
  limitations: [
    'This question cannot be answered directly. Try asking about an over, player figures, or a match recap.'
  ]
};

describe('MatchCompanionChat', () => {
  beforeEach(() => {
    queryMatchMock.mockReset();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders collapsed circular launcher button with styled DC emblem initially', () => {
    render(<MatchCompanionChat apiClient={{}} matchId="match-101" sessionId="session-xyz-123" />);

    const launcher = screen.getByRole('button', { name: 'Open Dream Companion' });
    expect(launcher).toBeInTheDocument();
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('DC')).toBeInTheDocument();
    expect(screen.queryByLabelText('Live Match Companion Chat')).not.toBeInTheDocument();
  });

  it('toggles chatbot open and closed when clicking launcher and collapse button', async () => {
    const user = userEvent.setup();

    render(<MatchCompanionChat apiClient={{}} matchId="match-101" sessionId="session-xyz-123" />);

    // Click launcher to open
    const launcher = screen.getByRole('button', { name: 'Open Dream Companion' });
    await user.click(launcher);

    expect(screen.getByLabelText('Live Match Companion Chat')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dream Companion' })).toBeInTheDocument();

    // Click collapse button in header
    const collapseBtn = screen.getAllByRole('button', { name: 'Collapse Dream Companion' })[0];
    await user.click(collapseBtn);

    expect(screen.queryByLabelText('Live Match Companion Chat')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Dream Companion' })).toBeInTheDocument();
  });

  it('renders all 5 canonical prompts and sends the exact string on click', async () => {
    queryMatchMock.mockResolvedValue(mockRecapResponse);
    const user = userEvent.setup();

    render(
      <MatchCompanionChat
        defaultOpen
        apiClient={{}}
        matchId="match-101"
        sessionId="session-xyz-123"
      />
    );

    // Assert all 5 canonical prompt labels exist
    expect(
      screen.getByRole('button', { name: 'What did I miss since I joined?' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Summarize the last over' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Summarize the last 10 minutes' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyse the last over' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze the first over' })).toBeInTheDocument();
    expect(screen.queryByText('Quick prompts:')).not.toBeInTheDocument();

    // Click "What did I miss since I joined?"
    await user.click(screen.getByRole('button', { name: 'What did I miss since I joined?' }));

    expect(queryMatchMock).toHaveBeenCalledWith(
      expect.anything(),
      'match-101',
      expect.objectContaining({
        query: 'What did I miss since I joined?',
        sessionId: 'session-xyz-123'
      })
    );

    expect(await screen.findByText('Over 16 Summary')).toBeInTheDocument();
    expect(screen.getByText('India accelerated scoring in this over.')).toBeInTheDocument();
    expect(screen.getByText('V Kohli hit boundary off ball 2')).toBeInTheDocument();
  });

  it('submits free-text queries and renders ANALYSIS responses with references', async () => {
    queryMatchMock.mockResolvedValue(mockAnalysisResponse);
    const user = userEvent.setup();

    render(
      <MatchCompanionChat
        defaultOpen
        apiClient={{}}
        matchId="match-101"
        sessionId="session-xyz-123"
      />
    );

    const input = screen.getByLabelText('Natural language match question');
    await user.type(input, 'How did Cummins bowl in over 16?');
    await user.click(screen.getByRole('button', { name: 'Send query' }));

    expect(queryMatchMock).toHaveBeenCalledWith(
      expect.anything(),
      'match-101',
      expect.objectContaining({
        query: 'How did Cummins bowl in over 16?',
        sessionId: 'session-xyz-123'
      })
    );

    // User question rendered
    expect(await screen.findByText('How did Cummins bowl in over 16?')).toBeInTheDocument();

    // Analysis card rendered
    expect(await screen.findByText('Tidy Over by Cummins')).toBeInTheDocument();
    expect(screen.getByText('Only 3 runs conceded with 4 dot balls.')).toBeInTheDocument();
    expect(screen.getByText('Ov 15.4')).toBeInTheDocument();
    expect(screen.getByText('Match Analysis')).toBeInTheDocument();
  });

  it('renders markdown-formatted answers using react-markdown', async () => {
    queryMatchMock.mockResolvedValue({
      kind: 'ANALYSIS',
      tool: 'OVER_ANALYSIS',
      answer: '### Detailed Over Breakdown\n\n**Jasprit Bumrah** delivered an exceptional spell.\n\n* Conceded only 2 runs\n* Bowled 4 dot balls',
      evidence: {},
      references: [{ type: 'DELIVERY', ballLabel: '18.1' }],
      limitations: []
    });
    const user = userEvent.setup();

    render(
      <MatchCompanionChat
        defaultOpen
        apiClient={{}}
        matchId="match-101"
        sessionId="session-xyz-123"
      />
    );

    const input = screen.getByLabelText('Natural language match question');
    await user.type(input, 'Detailed breakdown of Bumrah over');
    await user.click(screen.getByRole('button', { name: 'Send query' }));

    expect(await screen.findByRole('heading', { level: 3, name: 'Detailed Over Breakdown' })).toBeInTheDocument();
    expect(screen.getByText('Jasprit Bumrah')).toBeInTheDocument();
    expect(screen.getByText('Conceded only 2 runs')).toBeInTheDocument();
    expect(screen.getByText('Bowled 4 dot balls')).toBeInTheDocument();
    expect(screen.getByText('Match Analysis')).toBeInTheDocument();
  });

  it('renders UNSUPPORTED responses with helpful limitation notices', async () => {
    queryMatchMock.mockResolvedValue(mockUnsupportedResponse);
    const user = userEvent.setup();

    render(
      <MatchCompanionChat
        defaultOpen
        apiClient={{}}
        matchId="match-101"
        sessionId="session-xyz-123"
      />
    );

    const input = screen.getByLabelText('Natural language match question');
    await user.type(input, 'Who will win next year?');
    await user.click(screen.getByRole('button', { name: 'Send query' }));

    expect(
      await screen.findByText(/This question cannot be answered directly/)
    ).toBeInTheDocument();
    expect(screen.getByText('Query Notice')).toBeInTheDocument();
  });

  it('renders informative message when a 422 missing session error occurs', async () => {
    queryMatchMock.mockRejectedValue({
      status: 422,
      message: 'Join the match before asking what you missed.'
    });
    const user = userEvent.setup();

    render(<MatchCompanionChat defaultOpen apiClient={{}} matchId="match-101" sessionId={null} />);

    await user.click(screen.getByRole('button', { name: 'What did I miss since I joined?' }));

    expect(await screen.findByText(/Session marker required:/)).toBeInTheDocument();
  });

  it('renders AI unavailable notice when receiving a 503 error', async () => {
    queryMatchMock.mockRejectedValue({
      status: 503,
      message: 'AI service unavailable.'
    });
    const user = userEvent.setup();

    render(
      <MatchCompanionChat
        defaultOpen
        apiClient={{}}
        matchId="match-101"
        sessionId="session-xyz-123"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Summarize the last over' }));

    expect(
      await screen.findByText(/The match intelligence query service is temporarily unavailable/)
    ).toBeInTheDocument();
  });

  it('disables input and hides prompt buttons while request is in-flight to prevent duplicate submissions', async () => {
    let resolveQuery;
    queryMatchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveQuery = resolve;
      })
    );
    const user = userEvent.setup();

    render(
      <MatchCompanionChat
        defaultOpen
        apiClient={{}}
        matchId="match-101"
        sessionId="session-xyz-123"
      />
    );

    const promptBtn = screen.getByRole('button', { name: 'Summarize the last over' });
    await user.click(promptBtn);

    // In-flight state: prompt buttons disappeared on 1st prompt, submit button and input field disabled
    expect(screen.queryByRole('button', { name: 'Summarize the last over' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submitting query…' })).toBeDisabled();
    expect(screen.getByLabelText('Natural language match question')).toBeDisabled();

    // Resolve the promise
    resolveQuery(mockRecapResponse);

    expect(await screen.findByText('Over 16 Summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Natural language match question')).not.toBeDisabled();
  });

  it('clears conversation transcript when clicking clear transcript button and restores quick prompts', async () => {
    queryMatchMock.mockResolvedValue(mockRecapResponse);
    const user = userEvent.setup();

    render(
      <MatchCompanionChat
        defaultOpen
        apiClient={{}}
        matchId="match-101"
        sessionId="session-xyz-123"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Summarize the last over' }));
    expect(await screen.findByText('Over 16 Summary')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Summarize the last over' })).not.toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: 'Clear transcript' });
    await user.click(clearBtn);

    expect(screen.queryByText('Over 16 Summary')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear transcript' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Summarize the last over' })).toBeInTheDocument();
  });
});
