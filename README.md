# Live Cricket AI Copilot

A React and Express foundation for a grounded cricket companion. The MVP will
replay Cricsheet historical data as a simulated live feed through an in-house
Node.js replay engine. It is anonymous and does not yet connect to a live
provider, OpenAI, PostgreSQL, Redis, Socket.IO, or BullMQ.

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

## Phase 3 local replay

Phase 3 supports Cricsheet JSON 1.x files. The local `t20s_male_json/` archive
is intentionally ignored by Git; download it separately from Cricsheet. The
initial verified replay example is `t20s_male_json/1001349.json` (Australia v
Sri Lanka, 2017-02-17).

Start PostgreSQL and Redis, apply migrations, then enable replay when starting
the backend:

```powershell
docker compose up -d postgres redis
npm --workspace backend run db:deploy
$env:REPLAY_FILE = '../t20s_male_json/1001349.json'
$env:REPLAY_INTERVAL_MS = '1000'
npm run dev:backend
```

Replay is disabled unless `REPLAY_FILE` is set. A restarted replay resumes
without adding duplicate source deliveries. Cricsheet historical JSON does not
provide a trustworthy event-occurrence timestamp for each delivery, so replay
schedule time is never presented as the match event time.

The backend exposes `GET /api/matches/live`, `GET /api/matches/:matchId/state`,
and `GET /api/matches/:matchId/deliveries`. Socket.IO clients can join a match
with `join_match` and receive `delivery_added`, `delivery_corrected`,
`score_updated`, and `match_status_updated` events.

## Phase 4 Ask the Match API

Phase 4 exposes deterministic analytics before any AI narration:

- `GET /api/matches/:matchId/analytics/overs/:overNumber?innings=1`
- `GET /api/matches/:matchId/analytics/players/:playerId`
- `GET /api/matches/:matchId/analytics/overs/compare?innings=1&over1=0&over2=9`
- `GET /api/matches/:matchId/events/search` with optional `innings`, comma-separated `types`, `playerId`, `startSequence`, `endSequence`, `minimumImportance`, `limit`, and `cursor` filters
- `POST /api/matches/:matchId/ask` with a natural-language question

The Ask endpoint supports over analysis, player analysis, over comparison, and
factual timeline-event search. It uses an allow-listed backend tool to retrieve
verified facts, then passes only that evidence to the configured OpenAI client
for a concise explanation. It never gives the model database access. Event
search uses structured filters over stored timeline facts, not full-text search
over generated prose. Without `OPENAI_API_KEY`, the Ask endpoint returns a
clear `503` configuration response; deterministic analytics and event-search
endpoints remain available.

## Phase 5 Catch Me Up API

Phase 5 uses the same two-step AI orchestration as Ask the Match: the first
OpenAI call selects an allow-listed recap tool from the user's natural-language
query, backend code resolves its delivery window and deterministic evidence,
and the second OpenAI call narrates only that evidence. It exposes:

- `POST /api/matches/:matchId/sessions/join`
- `POST /api/matches/:matchId/sessions/leave` with `{ "sessionId": "uuid" }`
- `POST /api/matches/:matchId/summaries`

The summary body uses a natural-language `query`, with optional `sessionId` for
“what did I miss?” and `detail` set to `QUICK` or `DETAILED` (default:
`QUICK`). Supported examples include “summarize this over”, “summarize the last
2 overs”, “summarize the last 15 minutes”, “what did I miss?”, and “summarize
the whole match”. `LAST_OVER` and `LAST_N_OVERS` select completed overs from the
current innings only; a live partial over is excluded, while the final over of a
completed innings is included. The response includes the selected recap tool,
resolved delivery and over ranges, verified evidence, narrative references, and
explicit limitations. Session markers are anonymous opaque UUIDs tied to one
match.

The selected Cricsheet replay data does not supply trustworthy delivery
occurrence timestamps. A `LAST_N_MINUTES` request therefore returns a successful
`UNAVAILABLE` window with a limitation message and does not call the model.
Natural-language recap requests need `OPENAI_API_KEY`; without it, Catch Me Up
returns `503` while deterministic existing APIs continue to work.

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
change. Timeline facts are deterministic and require no OpenAI configuration.

## Documentation

- `docs/PRODUCT.md` — product behaviour and MVP scope
- `docs/ARCHITECTURE.md` — system boundaries and technical guardrails
- `docs/ROADMAP.md` — implementation phases
- `docs/OPEN_DECISIONS.md` — confirmed choices and remaining decisions
