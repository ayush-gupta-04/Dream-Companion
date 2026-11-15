# AGENTS.md — Live Cricket AI Copilot

## Project purpose

Build a live-cricket companion that turns ball-by-ball match data into useful, timely fan experiences. The MVP has three connected features: **Ask the Match**, **Catch Me Up**, and **Smart Match Timeline**. All three must use one shared Match Intelligence Engine; do not build three disconnected AI systems.

## Read these project documents first

- `docs/PRODUCT.md` — product scope, user stories, and feature behaviour.
- `docs/ARCHITECTURE.md` — system components, data flow, boundaries, and key technical decisions.
- `docs/ROADMAP.md` — implementation order, testing approach, and non-goals.
- `docs/OPEN_DECISIONS.md` — choices that are intentionally not finalized.

Treat these files as the project source of truth. When changing a material product or architecture decision, update the relevant document in the same change and explain why.

## Confirmed technology choices

- Frontend: React.js + JavaScript (JSX). Use a client-side React application; do not introduce Next.js or TypeScript.
- Backend: Node.js + Express.js + JavaScript (ES modules). Do not introduce NestJS or TypeScript.
- Database: PostgreSQL with Prisma ORM.
- Cache and fast live state: Redis.
- Real-time transport: Socket.IO.
- Background jobs: BullMQ using Redis.
- AI: Gemini API (Google AI Studio), called from the backend through a controlled AI orchestration layer.
- Local development: Docker Compose for infrastructure where practical.

Do not silently replace these choices. Suggest a change with trade-offs before implementing it.

## Architecture principles

- Start as a modular monolith with clear module boundaries. Do not create microservices for the MVP.
- PostgreSQL is the durable source of truth. Redis is a cache/live-state layer, not the permanent record.
- Cricket calculations and official statistics must be deterministic backend code. The LLM explains verified data; it must not invent or independently calculate official match figures.
- The LLM must never receive unrestricted database access. Expose narrowly scoped, validated backend tools/functions.
- Make ingestion idempotent and support provider corrections/revisions. Keep raw provider payloads when useful for debugging/reconciliation.
- Do not assume every over contains exactly six recorded delivery records. Model legal deliveries, extras, wickets, and provider-specific ball labels correctly.
- Do not use a display label such as `16.3` as a unique delivery key. Use a stable provider identifier where available and an internal ordered delivery sequence within an innings.
- Do not call the LLM for every ball. Prefer event-driven/background enrichment at meaningful points and on user request.
- Do not introduce video seeking or playback jump features; the product deliberately uses in-app timeline, over, and scorecard navigation.
- Keep provider-specific formats behind adapters; keep the domain model provider-neutral.

## Engineering workflow

1. Before implementation, inspect the repository and read the relevant project docs.
2. For a multi-file or architectural task, first provide a concise plan: files/modules to change, dependencies, risks, and verification steps. Wait for approval when the task is broad or would change a key decision.
3. After the Phase 1 foundation, work backend-first: complete and test the persistence, domain, ingestion, API, realtime, and AI/summary backend capability before implementing its feature UI. The existing frontend shell may be maintained for compatibility, but do not build feature-specific React views, hooks, or clients until the supporting backend contracts are stable and verified. Avoid speculative abstractions and premature infrastructure.
4. Prefer JavaScript modules and JSDoc documentation for domain contracts and API payloads. Validate external input at system boundaries.
5. Keep controllers thin; put business logic in services/domain modules. Keep provider integration, cricket rules, AI orchestration, persistence, and realtime delivery separated.
6. Add or update tests for changed behaviour. Run the relevant tests, lint, and build commands that actually exist in the repository. Do not claim checks passed unless they were run.
7. Never fabricate API-provider capabilities, sample live data, timestamps, video offsets, or credentials. Clearly label mock/demo data.
8. Never put API keys or secrets in source control. Update `.env.example` with variable names and safe placeholders only.
9. Do not install a new production dependency without briefly explaining why it is needed. Prefer existing dependencies when reasonable.
10. Do not make unrelated edits or overwrite user changes. Inspect `git status` before risky operations.

## Definition of done

A task is complete when its acceptance criteria are met, relevant tests/checks have been run, errors and limitations are reported honestly, and relevant documentation is updated. Include a concise summary of files changed and how to verify the result.

## Current implementation status

Phase 1 through Phase 7 frontend feature integration are complete. The React client provides a public landing page, Clerk-authenticated match directory, match workspace with compact factual state, video companion shell (no seeking/playback), scrollable Smart Match Timeline with Socket.IO realtime updates and provider-correction reconciliation, and the unified companion chat interface (Ask the Match and Catch Me Up) with canonical prompts, free-text queries, and grounded structured answers. On backend startup, local Cricsheet matches are persisted as historical data except `1001349.json`, which is the one user-triggered simulated-live replay; no admin replay controls exist. Gemini API (Google AI Studio) is the LLM provider; production hardening and deployment (Phase 8) remain.
