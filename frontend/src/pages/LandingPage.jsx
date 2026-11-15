import { Show, SignInButton, SignUpButton } from '@clerk/react';
import { CheckCircle2, ShieldCheck, Radio, MessageSquare, History, Clock } from 'lucide-react';

export const capabilities = [
  {
    number: '01',
    title: 'Ask the Match',
    description:
      'Ask a natural question and get a concise explanation grounded in verified ball-by-ball facts.'
  },
  {
    number: '02',
    title: 'Catch Me Up',
    description: 'Return to the action with a short, factual recap of the moments that matter.'
  },
  {
    number: '03',
    title: 'Smart Match Timeline',
    description:
      'Scan the match story through wickets, boundaries, milestones, and other key moments.'
  }
];

export function HeroActions() {
  return (
    <div className="hero-actions">
      <Show when="signed-out">
        <SignInButton>
          <button type="button" className="button button-primary">
            Sign in to follow a match
          </button>
        </SignInButton>
        <SignUpButton>
          <button type="button" className="button button-secondary">
            Create an account
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <a className="button button-primary" href="/matches">
          View matches <span aria-hidden="true">→</span>
        </a>
      </Show>
    </div>
  );
}

export function LandingPage() {
  return (
    <main id="main-content">
      <section className="hero content-width" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="hero-eyebrow-pill">
            <span className="hero-pulse-dot" aria-hidden="true" />
            <p className="eyebrow">A clearer way to follow cricket</p>
          </div>
          <h1 id="hero-title">Every important ball, made clear.</h1>
          <p className="hero-description">
            Dream Companion turns verified match data into useful context, so you can understand the
            game without digging through a scorecard.
          </p>
          <HeroActions />

          <div className="hero-trust-badges">
            <span className="hero-trust-badge">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
              Deterministic Match Facts
            </span>
            <span className="hero-trust-badge">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
              Zero AI Hallucinations
            </span>
            <span className="hero-trust-badge">
              <Radio className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
              Realtime Socket Streaming
            </span>
          </div>
        </div>

        <aside className="hero-note hero-preview-card" aria-label="Product promise">
          <div className="hero-card-accent-bar" aria-hidden="true" />
          <div className="hero-preview-header">
            <div className="hero-preview-match-meta">
              <span className="hero-live-badge">
                <span className="status-dot status-dot--live" aria-hidden="true" />
                LIVE
              </span>
              <span className="hero-match-name">India vs Australia</span>
            </div>
            <span className="hero-score-badge">142/3 (15.4 ov)</span>
          </div>

          <div className="hero-preview-chat-body">
            <div className="hero-chat-bubble hero-chat-bubble--user">
              <span>Analyse the last over</span>
            </div>
            <div className="hero-chat-bubble hero-chat-bubble--ai">
              <span className="hero-ai-badge">MATCH ANALYSIS</span>
              <p className="hero-ai-text">
                P Cummins bowled 6 legal deliveries conceding only 3 runs with 4 dot balls. Run rate
                checked from 9.4 to 9.1.
              </p>
              <div className="hero-ai-ref">
                <span className="hero-ref-tag">Ov 15.4</span>
                <span className="hero-ref-tag">Economy: 4.5</span>
              </div>
            </div>
          </div>

          <div className="hero-note-footer">
            <span className="hero-note-label">Built for the live edge</span>
            <p>Facts first. Insight second. No spoilers, streams, or playback controls.</p>
          </div>
        </aside>
      </section>

      <section className="capabilities content-width" aria-labelledby="capabilities-title">
        <div className="section-heading">
          <p className="eyebrow">Three focused tools</p>
          <h2 id="capabilities-title">The match companion, without the clutter.</h2>
          <p className="section-subtitle">
            Grounded intelligence designed specifically for cricket fans who want deeper answers in
            seconds.
          </p>
        </div>

        <div className="capability-grid">
          {capabilities.map((capability) => (
            <article className="capability-card" key={capability.title}>
              <div className="capability-card-top">
                <span className="capability-number" aria-hidden="true">
                  {capability.number}
                </span>
                <div className="capability-icon-pill" aria-hidden="true">
                  {capability.number === '01' && (
                    <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {capability.number === '02' && (
                    <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {capability.number === '03' && (
                    <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
              </div>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-note content-width" aria-labelledby="trust-title">
        <div className="trust-note-content">
          <div>
            <p className="eyebrow">Grounded by design</p>
            <h2 id="trust-title">Useful context, with the facts kept visible.</h2>
          </div>
          <p>
            The MVP replays historical Cricsheet data as a simulated live match. Analysis is based
            on stored match facts, and unavailable information is clearly identified.
          </p>
        </div>
        <div className="trust-metrics-grid">
          <div className="trust-metric-box">
            <span className="trust-metric-value">100%</span>
            <span className="trust-metric-label">Deterministic Rules</span>
          </div>
          <div className="trust-metric-box">
            <span className="trust-metric-value">&lt; 250ms</span>
            <span className="trust-metric-label">Live State Sync</span>
          </div>
          <div className="trust-metric-box">
            <span className="trust-metric-value">0</span>
            <span className="trust-metric-label">Hallucinated Runs</span>
          </div>
        </div>
      </section>
    </main>
  );
}
