# Architecture — Live Cricket AI Copilot

Keep the design production grade.
Keep the code quality good and readable.
Keep minimal code complexity.

## 1. Architecture style

Use an **event-driven modular monolith** for the MVP. Keep clear internal module boundaries, but deploy the API and background worker as separate processes from the same codebase if useful. Do not split into microservices prematurely.

### Delivery sequence

After the Phase 1 React shell and Express foundation, implementation proceeds backend-first. Finish and verify the provider-neutral domain, persistence, pipeline, backend APIs, realtime contracts, and feature services before adding feature-specific frontend experiences. This keeps the React client a consumer of tested contracts instead of a source of speculative product behaviour.

## 2. Technology baseline

| Layer       | Choice                                      | Responsibility                                               |
| ----------- | ------------------------------------------- | ------------------------------------------------------------ |
| Frontend    | React + JavaScript (JSX)                    | Match UI and three fan experiences                           |
| Backend     | Node.js + Express + JavaScript (ES modules) | REST APIs, domain orchestration, AI orchestration            |
| Database    | PostgreSQL + Prisma                         | Durable match/event/conversation data                        |
| Cache       | Redis                                       | Current match snapshot, hot reads, transient state           |
| Realtime    | Socket.IO                                   | Push live updates to connected clients                       |
| Jobs        | BullMQ + Redis                              | Asynchronous enrichment and summary work                     |
| AI          | OpenAI API                                  | Intent extraction and grounded natural-language explanations |
| Local infra | Docker Compose                              | Repeatable local PostgreSQL/Redis setup                      |

For the MVP, Cricsheet historical JSON 1.x data is the selected source and an in-house Node.js replay engine provides a simulated real-time feed. This is not a live commercial provider integration. The Phase 3 adapter uses source array position for an internal delivery sequence, source payload fingerprints for replay idempotency/corrections, and Cricsheet registry IDs for player identity. It does not infer event-occurrence timestamps from replay timing. Video seeking is intentionally excluded from scope; production hosting, OpenAI configuration, and any future live provider remain undecided. The MVP is anonymous and does not require an authentication provider.

## 3. High-level data flow

```text
Cricsheet historical match data
          |
          v
Node.js replay engine (controlled simulated-live pace)
          |
          v
Provider Adapter + Normalization
          |
          v
Delivery/Event Processor
          |
          +------------------------------+
          |                              |
          v                              v
Match Intelligence Engine          BullMQ jobs
  - Match State Manager              - summaries
  - Cricket Analytics                - event enrichment
  - Event Detection                  - notifications (later)
          |                              |
          +---------------+--------------+
                          |
             +------------+------------+
             |                         |
             v                         v
        PostgreSQL                  Redis
       durable source            cache/live state
             |                         |
             +------------+------------+
                          |
                          v
                AI Query / Summary Layer
                - intent & parameter parsing
                - validated domain tool calls
                - context assembly
                - grounded explanation
                          |
                          v
              Express REST API + Socket.IO
                          |
                          v
                    React Frontend
      Ask the Match | Catch Me Up | Smart Timeline
```

## 4. Backend modules and responsibilities

### 4.1 Ingestion module

- In the MVP, parse selected Cricsheet historical match files and accept replay-engine emissions at a controlled pace.
- Keep the adapter boundary so a future live provider can use polling or webhooks without changing provider-neutral domain code.
- Preserve provider payloads for debugging/reconciliation where practical.
- Convert provider-specific formats into internal domain contracts.
- Track provider IDs, revisions, occurrence timestamps, and ingestion timestamps separately.
- Apply idempotency and handle corrections/reordered updates.
- Do not assume every provider emits a complete event exactly once.

### 4.2 Match Intelligence Engine

One shared domain layer used by all three product features.

**Delivery processor**

- Validate normalized deliveries.
- Phase 2 persists validated, ordered deliveries and rebuilds derived state deterministically. Idempotency and revision reconciliation are deliberately deferred until before the replay pipeline is enabled.
- Persist delivery/event facts.
- Update match state and derived statistics.
- Emit internal domain events for downstream consumers.
- Correctly handle wides, no-balls, byes, leg-byes, penalty runs, wickets, and legal-delivery rules where applicable.

**Match State Manager**

- Maintain innings, score, wickets, overs, run rate, target, required run rate, current batter/bowler, and match status.
- PostgreSQL remains authoritative; Redis keeps a fast current snapshot.
- Example Redis keys (adapt after schema design):
  - `match:{matchId}:state`
  - `match:{matchId}:current_innings`
  - `match:{matchId}:recent_deliveries`

**Cricket Analytics Engine**

- Deterministic functions for over/player/phase/match analysis.
- Candidate metrics: total runs, wickets, boundaries, dots, extras, batter strike rate, bowler economy, partnership, run rate, required run rate, and phase performance.
- Keep scoring rules in tested domain code. LLM text must be derived from returned facts.

**Event Detection Engine**

- Start rule-based.
- Detect wickets, fours, sixes, milestones, partnerships, maiden/expensive overs, and selected match-context turning points.
- Assign a score/level based on event type and match context.
- Store factual event data immediately; generate optional prose enrichment asynchronously.

### 4.3 AI Query Orchestrator

- Receive a user query and match/session context.
- Use the model to classify intent and extract structured parameters.
- Validate match, innings, player, over, and range against backend data.
- Call only allow-listed domain functions.
- Assemble compact evidence/context from database and analytics results.
- Ask the model to explain the evidence in a structured response.
- Return event/delivery references for UI navigation.
- Handle unsupported questions and missing data transparently.

The model is not the source of truth and must not receive unrestricted database access.

For Phase 4, the Ask the Match API supports over analysis, player analysis,
over comparison, and factual timeline-event search. The orchestrator extracts a
structured intent, invokes a fixed backend allow-list, and asks the model to
narrate the resulting evidence. Event search uses validated structured filters
over persisted timeline records, never generated commentary or unrestricted text
search. The API returns deterministic facts and delivery/timeline references
separately from the model's interpretation. Missing credentials, provider
failures, refusals, or incomplete model output are surfaced as unavailable/error
states rather than replaced with invented analysis.

### 4.4 Catch Me Up / Summary Engine

- Resolve each recap request to a delivery sequence/time range.
- Fetch timeline events and deliveries for that range.
- Reuse cached over summaries and derived stats where useful.
- Generate quick or detailed narrative from this evidence.
- Store per-session join markers for “what did I miss?”.
- Refresh summaries after corrections to underlying deliveries.

Phase 5 resolves recap windows from ordered persisted deliveries on demand. It
stores only an anonymous session join marker (innings number and delivery
sequence), never a display label, and rebuilds evidence for each request. This
makes provider corrections visible immediately without a summary-cache
invalidation path. Catch Me Up follows the same two-step orchestration as Ask
the Match: the first model call can select only a validated recap tool
(`LAST_OVER`, `LAST_N_OVERS`, `LAST_N_MINUTES`, `SINCE_SESSION_JOIN`, or
`WHOLE_MATCH`) and bounded arguments; the selected backend tool resolves the
window and constructs evidence; a second model call narrates only that compact
deterministic evidence. The model never calculates match figures, selects
deliveries, or accesses the database. Cricsheet replay deliveries have no
trustworthy occurrence timestamps, so time-based recaps return an explicit
unavailable state rather than a false wall-clock approximation. `LAST_OVER` and
`LAST_N_OVERS` resolve only completed over groups from the current innings; a
live partial over is excluded and completion is inferred from an over
transition or completed innings, not a fixed delivery count. Timeline events
remain a Phase 6 enhancement and are not required for Phase 5 recaps.

### 4.5 Timeline Engine

- Consume events from the Match Intelligence Engine.
- Create/merge/deduplicate timeline records.
- Store ordering references and provider occurrence timestamp fields.
- Publish `timeline_event_created` through realtime transport.

Phase 6 stores each rule-derived event with a stable event key, its durable
delivery reference, an event ordinal, and separate importance score/level.
Timeline reconciliation derives the desired set from ordered persisted
deliveries inside a database transaction, then creates, updates, or removes
only changed records. This makes replay idempotent and repairs milestones or
completed-over events when a source delivery is corrected. The initial
transparent T20 rules are fours, sixes, wickets, 50/100 batter and partnership
milestones, maiden overs, overs conceding at least 15 runs, and conservative
scoring-rate shifts based on the previous two completed overs. Over completion
is inferred from a following source-over transition or completed innings, never
from a fixed number of delivery records. Video seeking and playback mapping
are intentionally excluded from scope to minimize complexity and focus on
in-app event navigation.

The API exposes ordered, cursor-paginated events through `GET
/api/matches/:matchId/timeline`. Socket.IO publishes
`timeline_event_created`, `timeline_event_updated`, and
`timeline_event_deleted` in the match room so a client can remain correct after
provider revisions; existing delivery and score event payloads are unchanged.

### 4.6 Realtime module

- REST for queries and commands; Socket.IO for push updates.
- Typical client flow: fetch current match state, connect socket, join a `match:{matchId}` room, then apply incremental updates.
- Candidate socket events: `score_updated`, `delivery_added`, `timeline_event_created`, `summary_updated`, `match_status_updated`, `ai_response_chunk`.
- If the API is horizontally scaled, use a Socket.IO Redis adapter and verify deployment support.

### 4.7 Background jobs

Use BullMQ for tasks that should not block ingestion or user requests. Candidate jobs:

- over summary generation/update;
- innings summary generation/update;
- timeline description enrichment;
- non-critical notifications (later).

Do not enqueue an LLM job on every ball. Trigger at meaningful boundaries (completed over, wicket, notable event, innings end) or on demand. Ensure jobs are idempotent and retry-safe.

## 5. Data model — conceptual starting point

Potential PostgreSQL entities:

- `Match`
- `Innings`
- `Delivery`
- `MatchStateSnapshot`
- `PlayerMatchStats`
- `OverSummary`
- `TimelineEvent`
- `MatchSession`
- `AIConversation`
- `AIMessage`

Relationships and constraints should be designed after inspecting the chosen provider's data contract. Important modelling rules:

- Each delivery belongs to an innings and has a stable internal `deliverySequence` for ordering.
- Store a provider delivery/event ID and revision when available.
- Keep display over/ball labels separate from unique identifiers. Labels can be unusual or change when providers correct feeds.
- Distinguish event occurrence time from ingestion/processing/creation times.
- Store original provider payload or a traceable reference when it supports audit/debugging.
- Make uniqueness/idempotency constraints explicit.
- In the Phase 2 schema, `(inningsId, deliverySequence)` is unique to prevent ambiguous ordering. Provider source identifiers are stored for future reconciliation, but duplicate/revision processing is not implemented yet.
- Do not model current state as the only record; retain delivery history so state can be reconstructed/reconciled.

Redis is for cached state and transient coordination; it is not a replacement for durable match records.

## 6. Candidate REST API surface

These are initial candidates, not a requirement to implement all at once.

**Matches**

- `GET /api/matches/live`
- `GET /api/matches/:matchId`
- `GET /api/matches/:matchId/state`
- `GET /api/matches/:matchId/deliveries`
- `GET /api/matches/:matchId/players`

**Ask the Match**

- `POST /api/matches/:matchId/ask`
- `GET /api/conversations/:conversationId`
- `GET /api/matches/:matchId/analytics/overs/:overNumber`
- `GET /api/matches/:matchId/analytics/overs/compare`
- `GET /api/matches/:matchId/analytics/players/:playerId`
- `GET /api/matches/:matchId/events/search`

**Catch Me Up**

- `POST /api/matches/:matchId/summaries`
- `GET /api/matches/:matchId/summaries/overs/:overNumber`
- `GET /api/matches/:matchId/summaries/innings/:inningsNumber`
- `POST /api/matches/:matchId/sessions/join`
- `POST /api/matches/:matchId/sessions/leave`

**Timeline**

- `GET /api/matches/:matchId/timeline`
- `GET /api/matches/:matchId/timeline/:eventId`
- `GET /api/matches/:matchId/timeline/:eventId/bookmark`

Define request/response contracts (documented with JSDoc where useful), runtime validation, pagination, and error semantics before implementing endpoints. Avoid exposing database models directly as API contracts.

## 7. Suggested repository shape

Keep the exact layout aligned with the actual repo, but aim for clear ownership:

```text
cricket-ai-copilot/
├── frontend/                 # React + JavaScript (JSX)
│   └── src/
│       ├── components/
│       ├── pages/             # or route-level views
│       ├── hooks/
│       ├── services/          # API/socket clients
│       └── context/
├── backend/                  # Express + JavaScript (ES modules)
│   ├── src/
│   │   ├── config/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── ingestion/
│   │   │   ├── match-intelligence/
│   │   │   ├── analytics/
│   │   │   ├── ai/
│   │   │   ├── summaries/
│   │   │   ├── timeline/
│   │   │   └── video/
│   │   ├── queues/
│   │   ├── workers/
│   │   ├── sockets/
│   │   └── app.js
│   └── prisma/schema.prisma
├── docs/
├── docker-compose.yml
└── README.md
```

This is a guide, not a mandate to create every folder upfront. Create modules as vertical slices require them.

## 8. In-app event navigation vs. Video seeking

Video seeking and actual video playback mapping are intentionally excluded from the architecture. Attempting to map live delivery events to video playback offsets introduces disproportionate engineering complexity (broadcast transmission latency, dynamic ad insertion, HLS/DASH manifest chunk drift, stream rebuffering, and video CDN licensing) while providing negligible real-world value during live play, where fans prioritize staying on the live edge.

The Smart Match Timeline, Ask the Match, and Catch Me Up focus strictly on important match moments, in-app scorecard/over deep linking, and contextual stats.

## 9. Reliability and security expectations

- Validate all provider payloads and user input.
- Rate-limit user-facing AI endpoints and enforce request size/time limits.
- Protect API keys and provider secrets in environment variables.
- The MVP is anonymous: do not introduce account authentication or private user data. If a persisted viewer-session marker is added later, use an opaque, non-identifying, unguessable session identifier and protect it from cross-session access.
- Add structured logs with match/provider/event identifiers; avoid logging secrets or unnecessary personal data.
- Make webhook handlers and queue processors idempotent.
- Handle provider downtime, delayed updates, stale cache, and partial match data.
- Reconcile Redis state from PostgreSQL when necessary.
- Keep AI output grounded and distinguish fact from interpretation.
