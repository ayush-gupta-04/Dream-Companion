import { useMemo } from 'react';
import { Show, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/react';
import { useBrowserRoute } from './app/routes.js';
import { MatchDirectory } from './features/matches/MatchDirectory.jsx';
import { MatchWorkspace } from './features/matches/MatchWorkspace.jsx';
import { createAuthenticatedApiClient } from './services/api.js';

const capabilities = [
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

export function ConfigurationError() {
  return (
    <main className="configuration-error" aria-labelledby="configuration-title">
      <p className="eyebrow">Dream Companion</p>
      <h1 id="configuration-title">Authentication setup required</h1>
      <p>
        Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to the frontend environment before starting the
        app.
      </p>
    </main>
  );
}

function HeroActions() {
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

function LandingPage() {
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
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Deterministic Match Facts
            </span>
            <span className="hero-trust-badge">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Zero AI Hallucinations
            </span>
            <span className="hero-trust-badge">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
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
                P Cummins bowled 6 legal deliveries conceding only 3 runs with 4 dot balls.
                Run rate checked from 9.4 to 9.1.
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
            Grounded intelligence designed specifically for cricket fans who want deeper answers in seconds.
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
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  )}
                  {capability.number === '02' && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                  )}
                  {capability.number === '03' && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
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
            The MVP replays historical Cricsheet data as a simulated live match. Analysis is based on
            stored match facts, and unavailable information is clearly identified.
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

function AuthenticationRequired() {
  return (
    <main
      className="workspace-shell content-width"
      id="main-content"
      aria-labelledby="sign-in-title"
    >
      <p className="eyebrow">Match directory</p>
      <h1 id="sign-in-title">Sign in to view matches.</h1>
      <p>Match data is available only to authenticated fans.</p>
      <SignInButton>
        <button className="button button-primary" type="button">
          Sign in
        </button>
      </SignInButton>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main
      className="workspace-shell content-width"
      id="main-content"
      aria-labelledby="not-found-title"
    >
      <p className="eyebrow">Page not found</p>
      <h1 id="not-found-title">That page is not available.</h1>
      <p>Return home to choose a supported next step.</p>
      <a className="button button-primary" href="/">
        Return home
      </a>
    </main>
  );
}

function SignedInMatchDirectory({ onNavigate }) {
  const { getToken } = useAuth();
  const apiClient = useMemo(() => createAuthenticatedApiClient(getToken), [getToken]);

  return <MatchDirectory apiClient={apiClient} onNavigate={onNavigate} />;
}

function SignedInMatchWorkspace({ matchId, onNavigate }) {
  const { getToken } = useAuth();
  const apiClient = useMemo(() => createAuthenticatedApiClient(getToken), [getToken]);

  return (
    <MatchWorkspace
      apiClient={apiClient}
      matchId={matchId}
      getToken={getToken}
      onNavigate={onNavigate}
    />
  );
}

function ProtectedMatchRoute({ children }) {
  return (
    <Show when="signed-in" fallback={<AuthenticationRequired />}>
      {children}
    </Show>
  );
}

function RouteContent({ route, onNavigate }) {
  if (route.name === 'landing') return <LandingPage />;

  if (route.name === 'match-directory') {
    return (
      <ProtectedMatchRoute>
        <SignedInMatchDirectory onNavigate={onNavigate} />
      </ProtectedMatchRoute>
    );
  }

  if (route.name === 'match-workspace') {
    return (
      <ProtectedMatchRoute>
        <SignedInMatchWorkspace matchId={route.matchId} onNavigate={onNavigate} />
      </ProtectedMatchRoute>
    );
  }

  return <NotFoundPage />;
}

export default function App() {
  const { route, navigate } = useBrowserRoute();

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header content-width">
        <a className="brand" href="/" aria-label="Dream Companion home">
          <span className="brand-mark" aria-hidden="true">
            DC
          </span>
          <span>Dream Companion</span>
        </a>

        <Show when="signed-in">
          <div className="account-menu" aria-label="Account menu">
            <UserButton />
          </div>
        </Show>
      </header>

      <RouteContent route={route} onNavigate={navigate} />

      <footer className="site-footer content-width">
        <span>Dream Companion</span>
        <span>Match intelligence for the moments you miss.</span>
      </footer>
    </div>
  );
}
