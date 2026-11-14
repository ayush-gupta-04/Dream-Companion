# Live Cricket AI Copilot

A React and Express foundation for a grounded cricket companion. The MVP will
replay Cricsheet historical data as a simulated live feed through an in-house
Node.js replay engine. It uses Clerk for authenticated access and connects to Gemini API (Google AI Studio),
PostgreSQL, Redis, and Socket.IO.

## Prerequisites

- Node.js 22 or newer (Node 24 is available in the current development environment)
- npm 10 or newer
- Docker Desktop, only when starting local PostgreSQL and Redis

## Local development

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d postgres redis
npm --workspace backend run db:deploy
npm run dev
```

The web app is available at `http://localhost:5173`; its development proxy
checks the API at `http://localhost:3001/health`.

Before starting the authenticated app, copy `frontend/.env.example` to
`frontend/.env` and add `VITE_CLERK_PUBLISHABLE_KEY`; add `CLERK_SECRET_KEY`
and `CLERK_AUTHORIZED_PARTIES` to the backend environment. Never put a Clerk
secret key in a `VITE_` variable.

## Verification

```powershell
npm run lint
npm run format:check
npm run test
npm run build
```

To run the opt-in PostgreSQL persistence integration test after Docker is
running and migrations are applied:

```powershell
$env:RUN_DATABASE_TESTS = 'true'
npm run test
```

## Phase 2 database commands

Prisma manages the PostgreSQL schema. Use the development migration command
when intentionally changing the schema; use deploy for the committed migration
history.

```powershell
npm --workspace backend run db:generate
npm --workspace backend run db:migrate -- --name descriptive_migration_name
npm --workspace backend run db:deploy
```

The Phase 2 database schema stores provider source references and enforces a
unique internal delivery sequence per innings. It does not yet implement
idempotent ingestion or provider-correction reconciliation; those are required
before replay ingestion is introduced.

## Historical archive and live simulation

The local `t20s_male_json/` archive is intentionally ignored by Git; download
it separately from Cricsheet. When the backend starts, it persists every JSON
file as a completed historical match. `1001349.json` (Australia v Sri Lanka,
2017-02-17) is deliberately excluded from delivery ingestion and is the one
simulated-live match.

Start PostgreSQL and Redis, apply migrations, then start the backend:

```powershell
docker compose up -d postgres redis
npm --workspace backend run db:deploy
$env:CRICSHEET_DATA_DIR = 't20s_male_json'
$env:LIVE_REPLAY_FILE = '1001349.json'
$env:REPLAY_INTERVAL_MS = '1000'
npm run dev:backend
```

The API waits for the archive import before listening. It skips already-complete
historical files with the same source revision on later restarts. When any
authenticated fan opens the designated live match, the backend clears only that
match's delivery-derived data and replays it. Other fans attach to the same
active replay; they do not restart it. After completion, a later visit begins a
fresh replay. There are no replay, speed, reset, or database-purge controls in
the UI or public API.

Cricsheet historical JSON does not provide a trustworthy event-occurrence
timestamp for each delivery, so replay scheduling time is never presented as
the match event time.

The backend exposes `GET /api/matches/live`, `GET /api/matches/:matchId/state`,
and `GET /api/matches/:matchId/deliveries`. The React workspace invokes the
authenticated `POST /api/matches/:matchId/live-simulation` endpoint only for
the backend-designated match; callers cannot select another source file or
replay speed. Socket.IO clients can join a match with `join_match` and receive
`delivery_added`, `delivery_corrected`, `score_updated`, and
`match_status_updated` events.

## Unified Ask the Match and Catch Me Up API

Ask the Match and Catch Me Up share one natural-language endpoint. Gemini first
selects exactly one validated backend tool, deterministic code collects the
evidence, and a second Gemini call writes the answer from that evidence only.
The model never accesses the database or calculates official figures.

- `POST /api/matches/:matchId/query` with `{ "query": "...", "sessionId": "optional UUID" }`

The response has a stable `kind` (`ANALYSIS`, `RECAP`, or `UNSUPPORTED`), the
selected `tool`, a concise `answer`, deterministic `evidence`, navigation
`references`, an optional recap `window`, and `limitations`. Every recap is
short: one concise summary and 3–5 factual bullets. There is no `detail`,
feature selector, `/ask`, or `/summaries` request contract.

The available analysis tools are over analysis, player analysis, over
comparison, and factual timeline-event search. The recap tools are last over,
last N completed overs, last N minutes where timestamps are trustworthy, since
session join, and whole match. Supporting deterministic endpoints remain
available:

- `GET /api/matches/:matchId/analytics/overs/:overNumber?innings=1`
- `GET /api/matches/:matchId/analytics/players/:playerId`
- `GET /api/matches/:matchId/analytics/overs/compare?innings=1&over1=0&over2=9`
- `GET /api/matches/:matchId/events/search` with optional `innings`, comma-separated `types`, `playerId`, `startSequence`, `endSequence`, `minimumImportance`, `limit`, and `cursor` filters
  Viewer-session markers remain separate supporting actions:

- `POST /api/matches/:matchId/sessions/join`
- `POST /api/matches/:matchId/sessions/leave` with `{ "sessionId": "uuid" }`
  Supported requests include “summarize this over”, “summarize the last 2 overs”,
  “summarize the last 15 minutes”, “what did I miss?”, and “summarize the whole
  match”. `LAST_OVER` and `LAST_N_OVERS` select completed overs from the current
  innings only; a live partial over is excluded, while the final over of a
  completed innings is included. Session markers are opaque UUIDs tied to one
  authenticated viewer and match.

The selected Cricsheet replay data does not supply trustworthy delivery
occurrence timestamps. A `LAST_N_MINUTES` request therefore returns a successful
`UNAVAILABLE` window with a limitation message and does not call the narration
model. Without `GEMINI_API_KEY`, the unified query endpoint returns `503` while
deterministic existing APIs continue to work.

## Phase 6 Smart Match Timeline API

Phase 6 creates a factual, rule-based timeline from the same persisted delivery
history used by the other backend features. Retrieve ordered events with:

- `GET /api/matches/:matchId/timeline`
- Optional query parameters: `innings`, comma-separated `types`, `limit`
  (1–100), and an opaque `cursor` returned as `nextCursor`.

Each event contains the match/innings identifiers, a stable delivery reference,
display position for navigation, event type, factual title and description,
importance score/level, and provider occurrence time when available. There are
no video offsets or video-seek claims.

Socket.IO clients already joined to `match:{matchId}` receive
`timeline_event_created`, `timeline_event_updated`, and
`timeline_event_deleted`. The latter two keep a connected client correct after
a provider correction; existing delivery and score socket payloads do not
change. Timeline facts are deterministic and require no Gemini configuration.

## Documentation

- `docs/PRODUCT.md` — product behaviour and MVP scope
- `docs/ARCHITECTURE.md` — system boundaries and technical guardrails
- `docs/ROADMAP.md` — implementation phases
- `docs/OPEN_DECISIONS.md` — confirmed choices and remaining decisions
