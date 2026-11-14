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

- Implement a Node.js replay/simulator that feeds selected Cricsheet historical match data through the ingestion pipeline at a controlled pace.
- Implement the Cricsheet adapter boundary. A future real-provider integration remains out of scope until its API coverage/licensing is evaluated.
- Update PostgreSQL and Redis state.
- Add BullMQ only for agreed asynchronous tasks.
- Broadcast score and delivery events via Socket.IO.

**Acceptance:** A replay advances match state; clients receive ordered updates; replay can be restarted without creating duplicate deliveries/events.

## Phase 4 — Ask the Match vertical slice

- Implement a small set of tested analytics functions (start with over analysis and player analysis).
- Add intent extraction and structured parameter validation.
- Implement allow-listed backend tools and context assembly.
- Produce a structured AI answer with delivery/timeline references.
- Define and test the REST request/response contract, including unsupported-question and missing-data semantics.

**Acceptance:** Example questions can be answered through the backend from fixture/live match facts; no fabricated statistics; all referenced events resolve to the correct match moment; the API contract is ready for a frontend client.

## Phase 5 — Catch Me Up

- Parse a natural-language recap request into one allow-listed recap tool and
  bounded parameters before resolving the requested window.
- Implement recap window resolution: last N minutes where timestamps allow, since session join, whole match, the just-ended over, and the last N completed overs.
- Store match session join markers.
- Generate quick and detailed summaries from deliveries, timeline events, and over summaries.
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

## Phase 7 — Frontend feature integration

- Build the React match experience against the completed backend contracts, beginning with loading, stale-data, and failure states.
- Add Ask the Match, Catch Me Up, and Smart Match Timeline views using shared API and Socket.IO client services.
- Keep factual event data distinct from AI interpretation, show the active match/innings context, and provide in-app event navigation.
- Add responsive and accessibility checks without introducing an unapproved design system.

**Acceptance:** The React app consumes real backend data and realtime events for all three MVP experiences; navigation references resolve correctly; loading, unavailable, delayed, and unsupported states are clear.

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
