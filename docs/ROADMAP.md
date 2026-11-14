# Implementation Roadmap

Build the project in small, reviewable slices. Do not attempt to implement all modules or all three features in one large generation task.

After the Phase 1 application shell, use a **backend-first delivery flow**: complete, test, and document backend contracts and behaviour before building feature-specific frontend UI. The frontend is intentionally consolidated into Phase 7 so it consumes stable APIs, Socket.IO events, and error semantics rather than provisional implementations.

## Phase 0 — Repository discovery and technical plan

- Inspect the existing workspace and git status.
- Confirm package manager, Node version, JavaScript/ES module settings, and whether the repository is empty or has existing code.
- Review `AGENTS.md` and all `docs/` files.
- Propose exact folder structure, initial dependencies, scripts, environment variables, and verification commands.
- Identify unresolved decisions from `docs/OPEN_DECISIONS.md`.
- Do not implement features in this phase. Produce a plan for review.

**Acceptance:** A reviewed implementation plan with assumptions and trade-offs. No unrelated application code changes.

## Phase 1 — Repository foundation

- Set up React + JavaScript (JSX) frontend and Express + JavaScript (ES modules) backend. Do not use TypeScript.
- Establish shared lint/format conventions for JavaScript if appropriate.
- Add health-check endpoint and a minimal frontend shell.
- Add `.env.example`, `.gitignore`, and local developer documentation.
- Add Docker Compose for PostgreSQL and Redis if this is part of the agreed setup.

**Acceptance:** Frontend and API start locally; health check succeeds; lint/test/build scripts work; no secrets are committed.

## Phase 2 — Cricket domain and persistence foundation

- Define provider-neutral domain contracts for Match, Innings, Delivery, and player identity.
- Design Prisma schema and migrations.
- Implement delivery validation, internal ordering, and deterministic state reconstruction. Reserve source-reference fields needed for later idempotency and correction support, but do not implement duplicate/revision handling in this phase.
- Implement deterministic core scoring/state calculations with unit tests.
- Create test fixtures for normal deliveries, wides, no-balls, byes, leg-byes, wickets, and unusual provider ball labels.

**Acceptance:** A sequence of normalized deliveries produces expected innings and player state; invalid or duplicate internal sequences are rejected by validation/database constraints; migrations and tests pass. Idempotent replay and provider-correction handling move to the live-pipeline work before replay is enabled.

## Phase 3 — Historical match replay and live pipeline

- On backend startup, persist the configured local Cricsheet archive as
  historical completed matches, using source revisions to skip unchanged files.
- Bootstrap exactly one configured source with metadata only; start its
  controlled replay only when an authenticated fan enters that workspace.
- Reset only that match's delivery-derived data between replays; concurrent
  fans attach to the active replay rather than restarting it.
- Implement the Cricsheet adapter boundary. A future real-provider integration remains out of scope until its API coverage/licensing is evaluated.
- Update PostgreSQL and Redis state.
- Add BullMQ only for agreed asynchronous tasks.
- Broadcast score and delivery events via Socket.IO.

**Acceptance:** Historical matches are available after startup, the one live
replay advances match state and emits ordered updates, and its repeatable reset
does not alter other matches or create duplicate deliveries/events.

## Phase 4 — Shared natural-language query and Ask the Match vertical slice

- Implement a small set of tested analytics functions (start with over analysis and player analysis).
- Add one structured tool-selection step and parameter validation for analysis and recap operations.
- Implement allow-listed backend tools and context assembly.
- Produce a structured AI answer with delivery/timeline references.
- Define and test the one `POST /api/matches/:matchId/query` contract, including unsupported-question and missing-data semantics.

**Acceptance:** Example questions can be answered through the backend from fixture/live match facts; no fabricated statistics; all referenced events resolve to the correct match moment; the API contract is ready for a frontend client.

## Phase 5 — Catch Me Up through the shared query endpoint

- Route natural-language recap requests through the shared allow-listed tool
  selector before resolving the requested window.
- Implement recap window resolution: last N minutes where timestamps allow, since session join, whole match, the just-ended over, and the last N completed overs.
- Store match session join markers.
- Generate short recaps from deliveries, timeline events, and over summaries:
  one concise summary plus 3–5 factual bullets.
- Recompute affected summaries when source deliveries are corrected.

Phase 5 uses on-demand evidence construction for the initial MVP rather than a
persisted recap cache. This keeps correction handling simple and deterministic;
an asynchronous or cached summary must later include an explicit source
revision/invalidation design before it is added.

**Acceptance:** Each natural-language recap request selects an allow-listed tool
before deterministic range resolution; each recap type selects the correct
range; approximate time windows are clearly labelled when reliable event
timestamps are missing.

## Phase 6 — Smart Match Timeline

- Implement rule-based notable-event detection and deduplication.
- Add importance scoring/levels.
- Persist timeline events and descriptions.
- Push new events over Socket.IO and document the REST/socket payload contracts.

Phase 6 uses transactional, on-demand reconciliation of one match's bounded
T20 delivery history. It keeps source corrections safe without a queue or
cache: newly derived events are created, changed events are updated, and events
no longer supported by corrected facts are deleted and announced to clients.

**Acceptance:** Important test events appear once, in correct order, with correct event references and no unsupported video-seek promise; the timeline backend contract is ready for a frontend client.

## Phase 6.5 — Authentication foundation (complete)

- Clerk is integrated with the React client and Express API. The publishable
  key is browser-only; the Clerk secret remains server-only. REST and Socket.IO
  use verified session tokens.
- User-facing match routes require authentication. `/health` and
  `/api/health` remain public. The configured live-match activation is available
  to every authenticated user and accepts no user-controlled replay settings.
- Each persisted `MatchSession` records its Clerk user/session identity.
  Session reads, recap queries, and leaves are owner-scoped.
- Missing Clerk configuration fails closed: the frontend presents setup
  guidance and protected backend routes return a configuration error rather
  than granting anonymous access.
- Tests cover unauthenticated (`401`), unconfigured (`503`), authenticated
  owner-scoping, and Socket.IO handshake paths without
  live Clerk credentials.

**Acceptance met:** No anonymous access is available for user-facing match
data or AI endpoints; viewer sessions are owner-scoped; Clerk secrets are not
sent to the browser; the migration is applied and integration-tested with
PostgreSQL and Redis.

## Phase 7 — Frontend feature integration

Deliver the frontend in five small, contract-first slices. Do not start a slice
until its listed backend contract is implemented and verified. Keep React in
JavaScript/JSX and use the existing client stack; do not add a routing or UI
framework unless a concrete need is reviewed first. Public landing content must
never expose protected match data; all match, session, query, and realtime work
uses the Clerk-authenticated client established in Phase 6.5.

### Phase 7.1 — Public landing page and authentication entry

- Replace the foundation-only screen with a public landing page at the root
  route. It explains the three MVP capabilities: Ask the Match, Catch Me Up,
  and Smart Match Timeline, without rendering live scores, match cards, or
  protected API data.
- Add a focused hero, concise product value statement, capability highlights,
  and a clear primary sign-in/sign-up call to action. Keep it lightweight and
  responsive; do not add a new design system or routing dependency.
- Use the existing Clerk provider to show sign-in/sign-up actions to signed-out
  visitors and a user menu plus a clear “View matches” continuation to signed-in
  visitors. Preserve a useful authentication-configuration message when the
  publishable key is absent.
- Ensure keyboard focus order, semantic landmarks, screen-reader labels,
  narrow-screen layout, and signed-out/signed-in/error states are covered by
  component tests. Mock Clerk in UI tests; do not depend on a live Clerk tenant.

**Acceptance:** A visitor can understand the product and start Clerk sign-in
from the public landing page. A signed-in visitor can continue to the protected
match directory, while no protected match data is requested or shown before
authentication.

### Phase 7.2 — Authenticated match directory and client foundation

- Add and test `GET /api/matches` before building the page. It returns a
  card-safe list of all available matches with at least an ID, display name,
  status, and freshness field. Keep `GET /api/matches/live` for consumers that
  need its existing live-only semantics.
- Build the signed-in match directory that loads the match list, renders
  accessible match cards, and makes `LIVE` status visually prominent. Do not
  infer live status from a timestamp or score.
- Use the shared frontend API client to obtain a fresh Clerk token for every
  protected request. Present explicit sign-in/session-expired (`401`),
  authorization (`403`), configuration (`503`), loading, empty, retryable
  error, and stale-data states.
- Selecting a card moves into the selected match workspace while retaining a
  clear way to return to the match list. Preserve the selected match ID in the
  URL or browser history without adding an unapproved dependency.
- Add component/API tests for list states and live highlighting.

**Acceptance:** After authentication, the directory renders all
backend-returned matches, highlights only `LIVE` matches, sends valid Clerk
Bearer tokens, and lets a user reliably enter and leave a selected match
workspace.

### Phase 7.3 — Match workspace and factual state

- Build the selected-match layout around `GET /api/matches/:matchId/state`.
  Present a compact, factual state card: match/innings context, score, wickets,
  overs, batters/bowler when available, and a visible freshness or unavailable
  state. Never calculate official figures in the browser.
- Add a clearly labelled video-player placeholder to the workspace. It is a
  visual shell only: no media source, controls, playback, seeking, or timeline
  to video mapping.
- On entering a match workspace, create one authenticated viewer-session marker through
  `POST /api/matches/:matchId/sessions/join`; retain its opaque ID locally for
  the page session and leave it when the workspace is exited when practical.
- Ensure keyboard focus, landmark structure, and narrow-screen layout work
  before adding timeline or chat complexity.

**Acceptance:** A selected match shows a truthful compact state and the
non-playing video placeholder, with clear loading/not-found/stale handling and
one usable authenticated viewer-session marker.

### Phase 7.4 — Scrollable Smart Match Timeline and realtime updates

- Fetch the initial cursor-paginated timeline from
  `GET /api/matches/:matchId/timeline`; render each item as a scrollable,
  factual event card with event type, importance, score/over reference, and
  description.
- Connect Socket.IO only after initial state is loaded, join the selected match
  room with a fresh Clerk session token, and reconcile `score_updated`, `delivery_added`,
  `match_status_updated`, and timeline create/update/delete events. Do not
  duplicate event cards or rely on arrival time for ordering. On an
  authentication-related socket failure, refresh/reacquire the token once and
  then show a sign-in or retry state instead of repeatedly reconnecting.
- Keep a timeline reference as in-app context for a later question or state
  focus only. It must never become a video-seek action.
- Test initial loading, pagination, an empty timeline, revision/deletion,
  disconnect/reconnect behaviour, and the card order.

**Acceptance:** The timeline remains ordered and correct through live updates
and provider corrections, while the compact match state updates from the same
match room.

### Phase 7.5 — Companion prompts, free-text chat, and end-to-end polish

- Add the five prewritten prompts: “What did I miss since I joined?”,
  “Summarize the last over”, “Summarize the last 10 minutes”, “Analyse the
  last over”, and “Analyze the first over”. A click sends the exact natural
  language to `POST /api/matches/:matchId/query` with the current session ID.
- Add a free-text query field that uses the same submission path and preserves
  a page-local, ordered conversation transcript. The client never chooses a
  tool or sends raw database/timeline data to Gemini.
- Render responses by their contract: distinguish `ANALYSIS`, `RECAP`, and
  `UNSUPPORTED`; show answer text separately from factual evidence/references;
  surface unavailable time-window limitations, AI `503` failures, and input
  validation errors clearly.
- Make prompt buttons and the form prevent duplicate submissions, announce
  loading/results accessibly, and support keyboard-only use. Verify responsive
  layout, live update behaviour while chat is open, and the full frontend
  against replay-backed API fixtures.

**Acceptance met:** Prompt and free-text submissions share one safe request path,
produce grounded responses with references, and clearly communicate
unsupported, unavailable, delayed, and provider-failure states. All three MVP
features (Ask the Match, Catch Me Up, and Smart Match Timeline) are fully integrated
into the Clerk-authenticated frontend workspace.

**Phase 7 completion:** The React app provides a public landing page and a
Clerk-authenticated journey into real match-list, state, timeline, session,
query, and Socket.IO contracts for all three MVP experiences. The designated
live match starts automatically on workspace entry without admin simulation
controls. It provides in-app event context only; it does not play, seek, or
synchronize video.

## Phase 8 — Hardening and deployment

- Add integration tests, logging, health/readiness checks, rate limits, and failure handling.
- Verify cache rebuild/reconciliation and queue retry behaviour.
- Select a deployment provider based on actual constraints. Evaluate any future live cricket provider separately; the MVP uses Cricsheet replay data.
- Deploy frontend, API, worker, PostgreSQL, and Redis with secret management.
- Document production setup, monitoring, and operational limitations.

**Acceptance:** A deployed environment runs end-to-end with a clear demo path, documented limitations, and no secrets in source control.

## Cross-cutting verification

- Unit-test cricket rules and analytics independently from the LLM.
- Test ingestion idempotency, duplicate events, corrections, delayed/out-of-order updates, and worker retries.
- Test API contracts and Socket.IO event payloads.
- Complete backend contract and integration testing before creating the corresponding feature UI; then test the React client against those stable contracts.
- Use deterministic fixtures/replay for repeatable feature tests.
- Verify AI answers against known test facts; test missing/ambiguous data and prompt-injection-like user inputs.
- Run only commands that exist in the repo and report results accurately.

## Explicit non-goals until justified

- Microservices, Kafka, vector database, multi-agent orchestration, advanced prediction ML, real-time video processing, video playback seeking/synchronization, and LLM calls on every ball.
