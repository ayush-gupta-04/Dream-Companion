# First prompt to give Codex

You are working in the repository for **Live Cricket AI Copilot**. Before doing anything, read the root `AGENTS.md` and all files in `docs/`.

The project has three MVP experiences: Ask the Match, Catch Me Up, and Smart Match Timeline. They must share one Match Intelligence Engine. The confirmed stack is React + JavaScript (JSX) on the frontend and Node.js + Express + JavaScript (ES modules) on the backend, with PostgreSQL + Prisma, Redis, Socket.IO, BullMQ, and the Gemini API (Google AI Studio). Do not switch to Next.js, NestJS, or TypeScript. Do not create `.ts`, `.tsx`, or `tsconfig.json` files. Follow the architecture and product constraints in the docs.

## Your task in this first session

Perform a **read-only discovery and planning pass**. Do not create application code, install dependencies, modify package files, run destructive commands, or make architecture/vendor decisions yet.

1. Inspect the existing repository, including `git status`, manifests, existing source code, tests, and configuration.
2. Read all project context documents.
3. Summarize the product and the three MVP features in your own words so I can verify your understanding.
4. Describe the proposed system flow from cricket data ingestion through the Match Intelligence Engine, persistence/caching, AI processing, realtime backend, and React UI.
5. Propose a practical folder structure that fits the actual repository. Avoid creating empty folders for speculative future modules.
6. Recommend the minimum dependencies and scripts for the first foundation phase. Explain why each dependency is needed. Do not install them.
7. Identify all unresolved decisions that block implementation, especially cricket data provider, historical replay source, timestamps, authentication, video sync, package manager, and deployment target.
8. Propose Phase 1 as a bounded implementation plan with exact files to create/change, acceptance criteria, risks, and commands you expect to run.
9. Explain how you will test the architecture incrementally, especially cricket scoring rules, ingestion idempotency, replay, and grounded AI responses.

## Important constraints

- Do not build all three features at once.
- Do not use microservices, Kafka, vector databases, multi-agent orchestration, or advanced ML for the initial MVP.
- After the Phase 1 frontend shell, implement and verify each feature's backend domain, persistence, API, and realtime contracts before building its React UI. Do not create feature-specific frontend placeholders against speculative backend behaviour.
- Do not call the LLM on every ball.
- Do not let the LLM query the database directly or invent match statistics.
- Do not assume a cricket API provides video offsets or exact event occurrence timestamps.
- Do not hardcode any provider before evaluating its actual API, rights, coverage, latency, and pricing.
- Do not treat display over/ball labels as stable unique delivery IDs.
- Keep PostgreSQL as the durable source of truth and Redis as cache/live state.
- Be explicit about assumptions and distinguish confirmed requirements from recommendations.

At the end, provide the proposed plan and wait for my approval before making changes.
