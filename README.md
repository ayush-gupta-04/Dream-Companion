# 🏏 Live Cricket AI Copilot (DreamCompanion)

[![Node.js Version](https://img.shields.io/badge/node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-18.3.1-blue.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/express-4.21.2-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL%2016-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/cache-Redis%207-red.svg)](https://redis.io/)
[![Socket.IO](https://img.shields.io/badge/realtime-Socket.IO%204.8-black.svg)](https://socket.io/)
[![Prisma ORM](https://img.shields.io/badge/orm-Prisma%206.5-2D3748.svg)](https://www.prisma.io/)
[![Google Gemini API](https://img.shields.io/badge/AI-Google%20Gemini-orange.svg)](https://ai.google.dev/)
[![Clerk Auth](https://img.shields.io/badge/auth-Clerk-6C47FF.svg)](https://clerk.com/)
[![Tailwind CSS](https://img.shields.io/badge/styling-TailwindCSS%203.4-38B2AC.svg)](https://tailwindcss.com/)

> **An intelligent, real-time, second-screen cricket companion and match analysis platform powered by Google Gemini and deterministic cricket analytics.**

---

## 📌 Table of Contents

- [What is Live Cricket AI Copilot?](#-what-is-live-cricket-ai-copilot)
  - [The Problem](#the-problem)
  - [The Solution: Second-Screen Intelligence](#the-solution-second-screen-intelligence)
  - [The Anti-Hallucination Architecture](#the-anti-hallucination-architecture)
- [What This Product Offers](#-what-this-product-offers)
  - [1. Ask the Match (Conversational Deep Analytics)](#1-ask-the-match-conversational-deep-analytics)
  - [2. Catch Me Up (Context-Aware Match Recaps)](#2-catch-me-up-context-aware-match-recaps)
  - [3. Smart Match Timeline (Real-Time Event Stream)](#3-smart-match-timeline-real-time-event-stream)
  - [4. High-Fidelity In-House Live Replay Engine](#4-high-fidelity-in-house-live-replay-engine)
  - [5. Second-Screen First User Experience](#5-second-screen-first-user-experience)
  - [6. Enterprise Authentication & Scoped Sessions](#6-enterprise-authentication--scoped-sessions)
- [System Architecture & Data Flow](#-system-architecture--data-flow)
- [Design Decisions & Scope Boundaries](#-design-decisions--scope-boundaries)
- [Technology Stack](#-technology-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Backend Development Quick Map](#-backend-development-quick-map)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone Repository & Install Dependencies](#1-clone-repository--install-dependencies)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Start PostgreSQL and Redis via Docker](#3-start-postgresql-and-redis-via-docker)
  - [4. Apply Database Migrations](#4-apply-database-migrations)
  - [5. Prepare Match Data (Cricsheet)](#5-prepare-match-data-cricsheet)
  - [6. Start the Servers](#6-start-the-servers)
- [API & WebSocket Specification](#-api--websocket-specification)
  - [REST API Endpoints](#rest-api-endpoints)
  - [Real-Time Socket.IO Events](#real-time-socketio-events)
- [Testing & Quality Verification](#-testing--quality-verification)
- [Documentation & Deep Dives](#-documentation--deep-dives)

---

## 💡 What is Live Cricket AI Copilot?

### The Problem
Cricket is one of the most statistically rich and fast-evolving sports in the world. A standard T20 match involves 240+ deliveries, frequent tactical shifts, momentum swings, and dozens of player matchups. However, the current viewing experience presents significant pain points:
- **The "Catch-Up" Dilemma**: Fans frequently join a match late, miss 20 minutes while commuting, or step away during key overs. Reconstructing what happened requires sifting through hundreds of lines of static ball-by-ball commentary or fragmented scorecard numbers.
- **Generic, Hallucinatory AI**: Standard generative AI tools hallucinate scores, invent non-existent boundaries, confuse batter strike rates, or calculate inaccurate required run rates when asked about a live sports event.
- **Cluttered Companion Apps**: Commercial sports apps bombard fans with advertisements, autoplay video delays, and fragmented navigation that distracts from the match broadcast.

### The Solution: Second-Screen Intelligence
**Live Cricket AI Copilot (DreamCompanion)** is built specifically as a **second-screen companion** for cricket enthusiasts. Designed to run on a mobile device, tablet, or laptop while watching the match broadcast on television, it provides immediate contextual awareness without spoilers.

It delivers instant match comprehension through three core pillars:
1. **Natural-language conversational match analysis** grounded strictly in verifiable delivery facts.
2. **Instant time-window and session-aware recaps** that condense missed action into a crisp summary with 3–5 key bullet points.
3. **A live, ordered event timeline** that highlights milestones, game-changing overs, and turning points in real-time via WebSockets.

### The Anti-Hallucination Architecture
In sports, factual accuracy is non-negotiable. Live Cricket AI Copilot guarantees mathematical and historical accuracy through a **Two-Stage Grounded Execution Pattern**:

```
User Query: "How has Bumrah bowled in his last 2 overs?"
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│  STAGE 1: LLM Cognitive Router (Gemini)                │
│  - Parses fan intent & extracts strict parameters      │
│  - Selects exactly one allow-listed deterministic tool │
│  - NO direct database access; NO math calculations     │
└────────────────────────┬───────────────────────────────┘
                         │ Tool: PLAYER_ANALYSIS { playerId, matchId }
                         ▼
┌────────────────────────────────────────────────────────┐
│  STAGE 2: Deterministic Domain Engine                  │
│  - Validates parameters against PostgreSQL & Redis     │
│  - Executes verified cricket algorithms (overs, dots,  │
│    boundaries, economy rate, extras, wickets)          │
│  - Assembles verified, authoritative match evidence    │
└────────────────────────┬───────────────────────────────┘
                         │ Deterministic Evidence + Delivery References
                         ▼
┌────────────────────────────────────────────────────────┐
│  STAGE 3: Grounded Narration Layer (Gemini)            │
│  - Explains the calculated evidence in natural English │
│  - Cites specific overs, deliveries, and milestones    │
│  - Constrained strictly to the evidence payload        │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
User Response: Grounded Answer + Evidence + In-App Navigation References
```

The LLM is **never** permitted to execute arbitrary SQL, query the database directly, or calculate cricket statistics. If data is unavailable or a query is out of bounds, the system responds with clear, transparent limitations rather than plausible fiction.

---

## 🚀 What This Product Offers

### 1. Ask the Match (Conversational Deep Analytics)
Fans can interrogate the live match in natural language and receive deep, tactical insights without ever opening a statistical spreadsheet.
- **Ball-by-Ball Over Analysis**: *"Analyze the 17th over."* -> Details every ball, runs scored, dot-ball pressure, bowler adjustments, and over economy.
- **Player Matchup & Spells**: *"How has Bumrah bowled today?"* -> Complete spell breakdown, phase-by-phase bowling analysis (powerplay, middle, death overs), wickets, and boundary suppression.
- **Comparative Over Insights**: *"Compare the 1st and 10th overs."* -> Evaluates changes in run rate, field restrictions, boundary frequencies, and tactical shifts.
- **Deep Event Search**: Search for specific match conditions, high-impact events, and player interactions using structured domain filters.

### 2. Catch Me Up (Context-Aware Match Recaps)
Never feel lost after stepping away from the screen. Catch Me Up generates punchy, context-aware digests tailored to whatever window you missed:
- **"What did I miss since I joined?"**: Automatically anchors to your authenticated viewer session marker when you enter the match room and summarizes all subsequent action.
- **"Summarize the last over"**: Synthesizes the just-completed over, including boundary strikes, wickets, and run-rate impact (excludes live, incomplete overs).
- **"Summarize the last N overs"**: Compiles a multi-over narrative spanning powerplay conclusions, middle-overs rebuilds, or death-over finishes.
- **"Summarize the whole match"**: Delivers an end-to-end match narrative highlighting key partnerships, turning points, and current match situation.
- **Standardized Response Format**: Every recap delivers an executive summary statement followed by 3–5 bulleted factual highlights with delivery citations.

### 3. Smart Match Timeline (Real-Time Event Stream)
A real-time, chronological feed of significant match events detected deterministically as deliveries occur:
- **Key Event Categories**:
  - 🔴 Wickets and dismissals (bowled, caught, run out, lbw, etc.)
  - 💥 Boundaries (fours and sixes)
  - 🎖️ Individual player milestones (50s, 100s)
  - 🤝 Partnership milestones (50, 100-run stands)
  - 🛡️ Maiden overs
  - ⚡ High-impact / expensive overs (≥ 15 runs conceded)
  - 📈 Notable scoring-rate and momentum shifts
- **Importance Scoring**: Events are categorized with explicit tiers (`MINOR`, `HIGHLIGHT`, `MAJOR`).
- **Real-Time WebSocket Sync**: New events are broadcast instantly via Socket.IO (`timeline_event_created`), with full support for corrections and rollbacks (`timeline_event_updated`, `timeline_event_deleted`).
- **Scorecard Deep Linking**: Click any event card in the timeline to focus the match workspace on that exact over or delivery.

### 4. High-Fidelity In-House Live Replay Engine
To provide a production-grade live match experience without requiring costly commercial feed licenses:
- **Cricsheet Historical Ingestion**: Ingests ball-by-ball Cricsheet JSON archives (covering thousands of international and league T20 matches).
- **Simulated-Live Streaming Engine**: Dedicated simulation manager replays delivery streams at configurable intervals (e.g., 1 delivery/sec) into the delivery processor.
- **Multi-Client Room Synchronization**: Concurrent viewers connecting to the designated live match attach to the same running replay room rather than spawning redundant simulations.
- **Idempotent Delivery Processing**: Unique `(inningsId, deliverySequence)` constraints and payload fingerprinting guarantee that replayed deliveries never corrupt or duplicate match statistics.

### 5. Second-Screen First User Experience
- **Responsive Workspace**: Built from the ground up for seamless usage on desktop, tablet, and mobile browsers.
- **Factual Current Match State**: Real-time scoreboard presenting runs, wickets, overs, current run rate (CRR), required run rate (RRR), active batters, and active bowler.
- **Interactive Chat Interface**: Includes one-click prompt pills (*"What did I miss?"*, *"Summarize last over"*, *"Analyze first over"*) alongside a free-text input field.
- **Accessible & Accessible Layout**: Semantic HTML5 landmarks, Radix UI accessibility, keyboard navigation, and screen-reader ready aria attributes.

### 6. Enterprise Authentication & Scoped Sessions
- **Clerk Identity Platform**: Secure, modern authentication powered by `@clerk/react` and `@clerk/express`.
- **WebSocket Handshake Validation**: Socket.IO connections require valid Clerk session tokens.
- **Owner-Scoped Viewer Sessions**: "Catch Me Up" session markers are strictly tied to the authenticated user's ID, preventing session leaks across users.
- **Fail-Closed Architecture**: In the absence of credentials, the platform fails gracefully with clear diagnostic messages rather than exposing unprotected match feeds.

---

## 🏛️ System Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           CRICKET DATA INGESTION                        │
│                                                                         │
│   ┌───────────────────────────┐         ┌───────────────────────────┐   │
│   │ Historical Cricsheet Data │         │ In-House Replay Engine    │   │
│   │ (Cold Archive Storage)    │         │ (Simulated Live Delivery) │   │
│   └─────────────┬─────────────┘         └─────────────┬─────────────┘   │
└─────────────────┼─────────────────────────────────────┼─────────────────┘
                  │                                     │
                  ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          BACKEND CORE (EXPRESS)                         │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ Cricsheet Provider Adapter & Ingestion Normalizer               │   │
│   └────────────────────────────────┬────────────────────────────────┘   │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ Delivery & Event Processor (Idempotency, Sequence, Rules)       │   │
│   └───────────────┬─────────────────────────────────┬───────────────┘   │
│                   │                                 │                   │
│                   ▼                                 ▼                   │
│   ┌───────────────────────────────┐ ┌───────────────────────────────┐   │
│   │ Match Intelligence Engine     │ │ Timeline Detection Engine     │   │
│   │ - State Manager (Runs, Overs) │ │ - Wickets, Fours, Sixes       │   │
│   │ - Cricket Analytics Engine    │ │ - Milestones, Big Overs       │   │
│   └───────────────┬───────────────┘ └───────────────┬───────────────┘   │
│                   │                                 │                   │
│                   ▼                                 ▼                   │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ STORAGE & CACHING                                               │   │
│   │  • PostgreSQL + Prisma: Authoritative Delivery & Match History  │   │
│   │  • Redis: Sub-millisecond Live Match State & Hot Delivery Cache │   │
│   └────────────────────────────────┬────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ TWO-STAGE AI QUERY ORCHESTRATOR                                 │   │
│   │  • Step 1: Cognitive Router (Gemini selects validated tool)     │   │
│   │  • Step 2: Deterministic Evidence Extraction (Analytics/Recap)  │   │
│   │  • Step 3: Grounded Explainer (Gemini narrates facts only)      │   │
│   └────────────────────────────────┬────────────────────────────────┘   │
│                                    │                                    │
│                   ┌────────────────┴────────────────┐                   │
│                   ▼                                 ▼                   │
│      ┌─────────────────────────┐       ┌─────────────────────────┐      │
│      │ REST API Endpoints      │       │ Real-Time Socket.IO     │      │
│      │ (Clerk Authenticated)   │       │ (Match Rooms & Push)    │      │
│      └────────────┬────────────┘       └────────────┬────────────┘      │
└───────────────────┼─────────────────────────────────┼───────────────────┘
                    │                                 │
                    ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND APPLICATION (REACT)                      │
│                                                                         │
│   ┌─────────────────────────┐ ┌───────────────────┐ ┌───────────────┐   │
│   │ Live Match State Card   │ │ Smart Timeline    │ │ CompanionChat │   │
│   │ (Score, Run Rates, RRR) │ │ (Event Feed, Tags)│ │ (Ask / Recap) │   │
│   └─────────────────────────┘ └───────────────────┘ └───────────────┘   │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ Clerk React Provider + Second-Screen Responsive Workspace       │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Design Decisions & Scope Boundaries

### Why Video Seeking is Deliberately Excluded
The companion workspace includes a dedicated non-playing video shell placeholder, but deliberately omits video playback controls, seeking, or video-stream synchronization. This is a deliberate, well-researched architectural decision:
1. **Fan Behavior on Live Broadcasts**: Live cricket viewers prioritize staying on the "live edge." Fans almost never rewind live sports because notifications, social media, and nearby cheers immediately produce spoilers.
2. **TV Broadcasters Handle Replays**: Television production crews already broadcast instant slow-motion replays from multiple camera angles within seconds of every wicket, boundary, or appeal.
3. **The Second-Screen Reality**: 90%+ of companion app usage happens on phones or tablets while the fan watches the game on a big-screen TV. A phone application cannot scrub the TV broadcast.
4. **Speed of Comprehension**: Rewinding 30 minutes of broadcast footage takes 30 minutes of viewing; reading a Catch Me Up summary or checking the Smart Match Timeline takes 15 seconds.
5. **Engineering Overhead**: Synchronizing live delivery events to video playback offsets requires overcoming broadcast latency drift (10–35s delay across platforms), Dynamic Ad Insertion (DAI), HLS/DASH manifest clock drift, and CDN licensing costs—yielding minimal real utility to a live fan.

---

## 🛠️ Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React (JSX) | `^18.3.1` | Declarative UI, second-screen match workspace |
| **Build & Dev Tool** | Vite | `^5.4.14` | High-performance bundling and HMR |
| **Styling & UI** | Tailwind CSS + Radix UI | `^3.4.19` | Accessible components, dark-mode design system |
| **Icons** | Lucide React | `^1.73.0` | Modern, clean iconography |
| **Backend Runtime** | Node.js (ES Modules) | `>= 20.0.0` | Asynchronous, event-driven server runtime |
| **Web Framework** | Express.js | `^4.21.2` | RESTful API routing, middleware, controllers |
| **Database & ORM** | PostgreSQL + Prisma ORM | `v16` / `^6.5.0` | Authoritative relational match/delivery persistence |
| **Cache & Live State** | Redis | `v7-alpine` | High-throughput match snapshots and hot caching |
| **Realtime Messaging** | Socket.IO | `^4.8.1` | Bidirectional WebSocket delivery and timeline push |
| **AI Intelligence** | Google Gemini API | Gemini Flash | Intent extraction & evidence-grounded explanations |
| **Authentication** | Clerk | `^3.29.0` (BE) / `^6.18.8` (FE) | User identity, JWT verification, session management |
| **Validation** | Zod | `^4.6.7` | Runtime request payload validation |
| **Testing** | Node Test Runner / Vitest | Built-in / `^2.1.9` | Comprehensive backend & frontend test suites |

---

## 📂 Project Directory Structure

```text
DreamCompanion-2/
├── backend/                       # Express + Prisma + Socket.IO Backend
│   ├── prisma/
│   │   ├── migrations/            # Version-controlled database migrations
│   │   └── schema.prisma          # Authoritative PostgreSQL data models
│   ├── src/
│   │   ├── auth/                  # Clerk authentication middleware & helpers
│   │   ├── config/                # Environment configuration loader
│   │   ├── controllers/           # HTTP Request Controllers
│   │   ├── db/                    # Prisma database client instance
│   │   ├── middleware/            # Error handling, rate limiting, auth validation
│   │   ├── modules/
│   │   │   ├── ai/                # Gemini client, tool caller & grounded narrator
│   │   │   ├── analytics/         # Deterministic over/player/comparison algorithms
│   │   │   ├── ingestion/         # Cricsheet JSON parser & normalizer
│   │   │   ├── match-intelligence/# Match state engine, scoring rules, cache
│   │   │   ├── matches/           # Match directory & metadata services
│   │   │   ├── summaries/         # Catch Me Up window resolver & evidence builder
│   │   │   └── timeline/          # Rule-based timeline event detector & search
│   │   ├── replay/                # In-house simulated-live replay manager
│   │   ├── routes/                # Express router definitions
│   │   ├── schemas/               # Zod validation schemas for API contracts
│   │   ├── sockets/               # Socket.IO room management & push broadcaster
│   │   └── server.js              # Server bootstrapper & lifecycle manager
│   ├── tests/                     # Unit and integration test suites
│   ├── docker-compose.yml         # Local PostgreSQL and Redis container orchestration
│   ├── .env.example               # Backend environment template
│   └── package.json
│
├── frontend/                      # React 18 + Vite + Tailwind CSS Frontend
│   ├── src/
│   │   ├── app/                   # Route configuration and app shells
│   │   ├── components/            # Reusable UI primitives (Button, Card, Badge, etc.)
│   │   ├── features/
│   │   │   ├── chat/              # Ask the Match & Catch Me Up chat interface
│   │   │   ├── matches/           # Match cards, directory listing, workspace views
│   │   │   └── timeline/          # Smart Match Timeline scrollable feed & cards
│   │   ├── pages/                 # Route-level pages (Landing, Matches, Workspace)
│   │   ├── services/              # API and Socket.IO client connections
│   │   └── main.jsx               # Application entry point & Clerk Provider
│   ├── .env.example               # Frontend environment template
│   ├── tailwind.config.js         # Tailwind configuration & typography tokens
│   ├── vite.config.js             # Vite proxy and build settings
│   └── package.json
│
├── docs/                          # In-depth architectural & product documentation
│   ├── ARCHITECTURE.md            # System boundaries, data schemas & tech guardrails
│   ├── PRODUCT.md                 # Product specifications, user stories & MVP scope
│   ├── ROADMAP.md                 # Completed implementation phases (0 through 7)
│   ├── OPEN_DECISIONS.md          # Architectural decisions log & rationale
│   └── AGENTS.md                  # Autonomous agent guidelines & workspace conventions
│
└── README.md                      # Project documentation (this file)
```

---

## 🔧 Backend Development Quick Map

The backend follows a simple request path:

```text
src/server.js → src/app.js → routes → controllers → modules → Prisma
```

- `src/server.js` starts HTTP, Socket.IO, Redis, and archive bootstrapping.
- `src/app.js` configures middleware and mounts API routers.
- `src/routes/` maps endpoints to controllers.
- `src/controllers/` handles HTTP input and responses.
- `src/modules/` contains feature-specific business logic; `src/db/prisma.js` provides the shared database client.
- Modules import the shared Prisma, Redis, and Socket.IO instances and direct AI functions. The server owns connection startup and shutdown.
- Delivery repository functions accept a Prisma transaction client when a multi-step write must stay atomic.

For local backend development:

```powershell
cd backend
npm install
docker compose up -d postgres redis
npm run db:deploy
npm run dev
```

Useful checks are `npm run lint`, `npm test`, and `npm run test:db` (the last requires local PostgreSQL and Redis).

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: `v20.0.0` or higher (`v22` / `v24` recommended)
- **npm**: `v10.0.0` or higher
- **Docker Desktop**: Required for local PostgreSQL 16 and Redis 7 containers
- **Google AI Studio API Key**: For Gemini model access ([Get API Key](https://aistudio.google.com/))
- **Clerk Account**: For user authentication ([Get Clerk Keys](https://clerk.com/))

---

### 1. Clone Repository & Install Dependencies

Clone the repository and install dependencies in both the `backend` and `frontend` directories:

```powershell
# In the project root:
cd backend
npm install

cd ../frontend
npm install
cd ..
```

---

### 2. Configure Environment Variables

#### Backend Configuration (`backend/.env`)
Create `backend/.env` from the provided example:

```powershell
Copy-Item backend/.env.example backend/.env
```

Update the values in `backend/.env`:
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Clerk Authentication (Server)
CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
CLERK_AUTHORIZED_PARTIES=http://localhost:5173

# Persistence & Cache
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cricket_copilot?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# Simulation & Match Data
CRICSHEET_DATA_DIR=t20s_male_json
LIVE_REPLAY_FILE=1001349.json
REPLAY_INTERVAL_MS=1000

# Google Gemini API
GEMINI_API_KEY=AIzaSy_your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_OUTPUT_TOKENS=2000
GEMINI_THINKING_LEVEL=MINIMAL
```

#### Frontend Configuration (`frontend/.env`)
Create `frontend/.env` from the provided example:

```powershell
Copy-Item frontend/.env.example frontend/.env
```

Update `frontend/.env`:
```env
# Clerk Authentication (Browser Client)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key

# Optional: Leave empty in local dev to let Vite proxy socket requests
VITE_SOCKET_URL=
```

> [!CAUTION]
> **Never** expose the `CLERK_SECRET_KEY` or `GEMINI_API_KEY` in the `frontend/.env` file. Only publishable keys prefixed with `VITE_` belong in the browser client.

---

### 3. Start PostgreSQL and Redis via Docker

Launch PostgreSQL 16 and Redis 7 using Docker Compose:

```powershell
cd backend
docker compose up -d postgres redis
cd ..
```

To verify the containers are healthy:
```powershell
docker compose -f backend/docker-compose.yml ps
```

---

### 4. Apply Database Migrations

Deploy the Prisma migrations to initialize the PostgreSQL schema:

```powershell
cd backend
npm run db:deploy
cd ..
```

*(Optional)* To inspect the database using Prisma Studio:
```powershell
cd backend
npm run db:studio
```

---

### 5. Prepare Match Data (Cricsheet)

Place your Cricsheet T20 JSON match archive in `backend/t20s_male_json/`. 
- Upon backend startup, all JSON files in this directory are indexed and persisted as historical completed matches.
- The designated `LIVE_REPLAY_FILE` (default: `1001349.json` — Australia vs Sri Lanka, 2017) is reserved as the active live-simulation match.

---

### 6. Start the Servers

Start both the backend API server and the frontend development server:

#### Terminal 1 — Backend:
```powershell
cd backend
npm run dev
```
*The backend API will start on `http://localhost:3001`.*

#### Terminal 2 — Frontend:
```powershell
cd frontend
npm run dev
```
*The React application will be available at `http://localhost:5173`.*

---

## 📡 API & WebSocket Specification

### REST API Endpoints

All application routes (except `/health`) require a valid Clerk Bearer JWT token in the `Authorization` header.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` / `/api/health` | Public service health and database/redis readiness check |
| `GET` | `/api/matches` | Card-safe summary directory of all historical and live matches |
| `GET` | `/api/matches/live` | Retrieve the active simulated live match status |
| `GET` | `/api/matches/:matchId/state` | Current factual match scoreboard (runs, overs, wickets, run rates) |
| `GET` | `/api/matches/:matchId/deliveries` | Retrieve historical or current delivery records |
| `POST` | `/api/matches/:matchId/live-simulation` | Trigger / attach to the in-house live simulation replay |
| `POST` | `/api/matches/:matchId/query` | **Unified Natural Language Endpoint** (Ask the Match & Catch Me Up) |
| `GET` | `/api/matches/:matchId/timeline` | Ordered, cursor-paginated Smart Match Timeline events |
| `POST` | `/api/matches/:matchId/sessions/join` | Register an authenticated viewer session marker for Catch Me Up |
| `POST` | `/api/matches/:matchId/sessions/leave` | Clean up an active viewer session |
| `GET` | `/api/matches/:matchId/analytics/overs/:overNumber` | Deterministic ball-by-ball analysis of a specific over |
| `GET` | `/api/matches/:matchId/analytics/players/:playerId` | Deterministic player performance and bowling spell breakdown |
| `GET` | `/api/matches/:matchId/analytics/overs/compare` | Deterministic comparison between two overs |
| `GET` | `/api/matches/:matchId/events/search` | Search match events using structured criteria |

#### Example Unified Query Request:
```bash
POST /api/matches/1001349/query
Authorization: Bearer <clerk_session_token>
Content-Type: application/json

{
  "query": "How did the 19th over go?",
  "sessionId": "a24c52df-6c84-44a6-96b5-7728f3214b60"
}
```

#### Example Unified Query Response:
```json
{
  "kind": "ANALYSIS",
  "tool": "OVER_ANALYSIS",
  "answer": "The 19th over was decisive, conceding 18 runs with two boundaries and a crucial wicket on the fourth delivery.",
  "evidence": {
    "innings": 1,
    "overNumber": 18,
    "totalRuns": 18,
    "wickets": 1,
    "dots": 1,
    "boundaries": 2,
    "deliveries": [...]
  },
  "references": [
    { "type": "OVER", "innings": 1, "overNumber": 18 },
    { "type": "DELIVERY", "deliverySequence": 112 }
  ],
  "limitations": null
}
```

---

### Real-Time Socket.IO Events

Clients authenticate their WebSocket connection using their Clerk session token and join match rooms via `join_match`.

| Event Name | Direction | Payload Description |
| :--- | :--- | :--- |
| `join_match` | Client ➔ Server | `{ "matchId": "1001349" }` — Join the live broadcast room |
| `score_updated` | Server ➔ Client | Incremental scoreboard update (score, wickets, overs, run rate) |
| `delivery_added` | Server ➔ Client | Newly delivered ball with runs, batter, bowler, extras details |
| `match_status_updated`| Server ➔ Client | State transition (`IN_PROGRESS`, `COMPLETED`, innings change) |
| `timeline_event_created`| Server ➔ Client | New rule-detected highlight card (boundary, wicket, milestone) |
| `timeline_event_updated`| Server ➔ Client | Reconciliation update following provider score corrections |
| `timeline_event_deleted`| Server ➔ Client | Removal of an event card if underlying deliveries were revised |

---

## 🧪 Testing & Quality Verification

Both backend and frontend contain rigorous automated test suites verifying cricket domain rules, anti-hallucination query pipelines, and reactive UI components.

### Backend Verification:
```powershell
cd backend

# Run domain unit tests, schema validation, and mock AI orchestrator tests:
npm run test

# Run integration tests against active PostgreSQL and Redis instances:
npm run test:db
```

### Frontend Verification:
```powershell
cd frontend

# Run Vitest component tests (Landing, Directory, Timeline, Chat):
npm run test

# Validate production build:
npm run build
```

---

## 📚 Documentation & Deep Dives

For detailed engineering guidelines, schema definitions, and design histories, consult the `docs/` directory:

- [**docs/PRODUCT.md**](docs/PRODUCT.md) — Comprehensive product requirements, feature specifications, and fan persona definitions.
- [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) — System boundaries, two-stage AI architecture, database schemas, and caching strategies.
- [**docs/ROADMAP.md**](docs/ROADMAP.md) — Step-by-step implementation milestones from Phase 0 to Phase 7 completion.
- [**docs/OPEN_DECISIONS.md**](docs/OPEN_DECISIONS.md) — Technical trade-offs, rationale for chosen providers, and deferred features.
- [**docs/AGENTS.md**](docs/AGENTS.md) — Engineering standards and workflow conventions for autonomous developer agents.

---

## 📄 License & Attribution

- Built with data from [Cricsheet](https://cricsheet.org/) (licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)).
- All intellectual property, trademarks, and sports logos belong to their respective rights holders.
