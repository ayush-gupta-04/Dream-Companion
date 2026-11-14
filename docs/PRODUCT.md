# Product Requirements — Live Cricket AI Copilot

## 1. Product vision

Create an AI-powered companion for fans following a cricket match. It should help viewers understand what is happening, catch up when they miss play, and discover the most important match moments without having to manually inspect scorecards or ball-by-ball commentary. The first MVP simulates live play by replaying Cricsheet historical data through an in-house Node.js engine; it does not claim to provide a live commercial feed.

The three MVP experiences share the same live match data and intelligence layer:

1. Ask the Match
2. Catch Me Up
3. Smart Match Timeline

## 2. Feature: Ask the Match

### Goal

Let a fan ask natural-language questions about the current match and receive concise, fact-grounded cricket analysis.

### Example questions

- “Analyse the first over.”
- “How has Bumrah bowled today?”
- “Compare the 1st and 10th overs.”
- “Analyse the 17th over.”

### Expected answer content (as applicable)

- A short overview or headline conclusion.
- Ball-by-ball breakdown for the requested over/range.
- Runs, wickets, boundaries, dots, and extras.
- Batter and bowler performance.
- Run-rate / required-run-rate context where relevant.
- Important moments and tactical interpretation.
- References to innings, over, delivery, and timeline event.
- In-app timeline and over references (video seeking is deliberately excluded).

### Initial supported intents

- `OVER_ANALYSIS`
- `PLAYER_ANALYSIS`
- `OVER_COMPARISON`
- `MATCH_PHASE_ANALYSIS`
- `EVENT_SEARCH`
- `MATCH_QUESTION`

The AI layer should identify intent and parameters, validate them, invoke specific backend functions, and explain the returned facts. It must not query the database directly or invent missing statistics. If a question is ambiguous, ask a focused clarification or state the assumption.

### Candidate domain functions

- `analyzeOver(matchId, innings, overNumber)`
- `analyzePlayer(matchId, playerId)`
- `compareOvers(matchId, innings, over1, over2)`
- `getMatchStatistics(matchId)`
- `analyzeMatchPhase(matchId, innings, phase)`
- `getDeliveries(matchId, innings, startSequence, endSequence)`
- `searchMatchEvents(matchId, filters)`

These are conceptual contracts; inspect the actual schema and refine them during implementation.

## 3. Feature: Catch Me Up

### Goal

Give a fan a useful recap of match action they missed or a chosen period of play.

### Recap windows

- Last 10 minutes.
- What did I miss since I joined?
- The whole match so far.
- The just-ended over.
- The last N completed overs.

### Detail levels

- Quick recap: approximately 3–5 concise bullets focused on key events.
- Detailed recap: a structured narrative with relevant overs, wickets, partnerships, player contributions, and turning points.

### Natural-language requests

- A fan can ask for a recap in natural language, for example “summarize this
  over”, “summarize the last 2 overs”, or “summarize the last 15 minutes”.
- The AI first selects one bounded recap tool and extracts only its required
  parameter (such as an over count or minute count). Backend code validates the
  selection, resolves the exact window, and calculates all recap facts. A
  second AI call writes the response solely from that deterministic evidence.
- “This over” means the most recently completed over. It never includes a live
  partial over.

### Behaviour and accuracy

- First resolve the requested window to a precise set of deliveries/events; then summarize that set.
- `LAST_OVER` summarizes the just-ended completed over. `LAST_N_OVERS` summarizes the most recent requested number of completed overs in the current innings. Neither includes a live partial over; the final over is complete only when the innings is complete. Do not infer completion from a fixed count of recorded delivery records.
- When fewer than the requested number of completed overs are available in the current innings, summarize those available and disclose the limit.
- For “what did I miss?”, record a viewer/session join marker and summarize events after that marker.
- Prefer the provider's event-occurrence timestamp for time-window recaps, not the backend ingestion timestamp.
- If the provider does not provide trustworthy event timestamps, clearly disclose the limitation. A provider with partial, bounded timestamps may support an approximate recap; a provider such as the selected Cricsheet replay source with no delivery occurrence timestamps returns the time window as unavailable rather than inventing a ball-sequence approximation.

## 4. Feature: Smart Match Timeline

### Goal

Maintain a live, ordered feed of notable match events so fans can scan the match narrative quickly.

### Initial event categories

- Wicket.
- Four.
- Six.
- Player milestone.
- Partnership milestone.
- Maiden over.
- Expensive / high-impact over.
- Scoring-rate shift or other contextually significant moment.

Start with transparent, rule-based event detection. Add ML only if a later requirement demonstrates a real need.

### Each event should include

- Match and innings identifiers.
- Stable delivery reference / sequence.
- Display over and ball label.
- Event type/category.
- Event title and short factual description.
- Importance score and importance level (for example `MINOR`, `HIGHLIGHT`, `MAJOR`).
- Event occurrence timestamp, when supplied reliably.
- In-app navigation references (innings, over, ball label) to deep link to scorecard views or trigger focused over analysis.

Event type and importance are separate concepts. A four is an event type; whether it is a major highlight depends on match context. The event should appear as soon as its factual detection is available. Optional LLM-generated wording may be enriched asynchronously.

## 5. Shared product behaviour

- All features operate on the same match/innings/delivery data model.
- The UI should make it clear which match and innings the answer refers to.
- Responses should cite or link back to relevant over/ball/timeline events inside the application.
- Live data may be delayed, revised, or temporarily unavailable. Show freshness/loading/error states rather than silently presenting stale data as live.
- Separate factual match events from commentary or AI interpretation.
- Clearly distinguish unavailable information from a zero value.

## 6. Scope decision: Video seeking excluded in favor of Event Timeline

Video seeking and actual video playback synchronization are intentionally excluded from the product scope.

### Rationale:

1. **Fan behavior during live matches**: Viewers almost never jump backwards in a video stream while watching a live match because they prioritize staying on the "live edge" and avoiding spoilers from social media, notifications, or nearby viewers.
2. **Broadcaster instant replays**: TV production directors already broadcast multiple slow-motion replays within seconds of every boundary, wicket, or milestone.
3. **Second-screen reality**: Fans predominantly use companion applications on a mobile device while watching the primary live broadcast on a television screen, making phone-to-TV video seeking impossible.
4. **Speed of catching up**: Rewinding 30 minutes of video takes 30 minutes of playback; reading the Smart Timeline or Catch Me Up takes 15 seconds.
5. **Technical complexity vs. utility**: Mapping live delivery events to video playback offsets introduces massive engineering overhead—including variable broadcast delays (10–35s), dynamic ad insertion (DAI), HLS/DASH chunk drift, stream rebuffering, and licensing/CDN costs—with negligible real-world utility for live fans.

**Conclusion:** The Smart Match Timeline will strictly focus on displaying important match events (wickets, boundaries, milestones, expensive overs, scoring-rate shifts) with in-app scorecard/over navigation. There is no video seeking button or playback synchronization in the live match experience.

## 7. MVP boundaries

### In scope

- One supported Cricsheet historical-data adapter, replayed as a simulated live feed by an in-house Node.js engine.
- Replay score/delivery ingestion and normalized data model.
- Deterministic cricket calculations for selected MVP metrics.
- One shared Match Intelligence Engine.
- The three user-facing experiences above.
- Realtime UI updates.
- Repeatable historical match replay/simulation for development, testing, and MVP demos.
- Anonymous use; no account or login requirement.

### Not required for the first MVP

- Microservices.
- Kafka or a large streaming platform.
- Vector database / RAG over unstructured content.
- Multi-agent AI architecture.
- Advanced ML prediction models.
- LLM calls for every delivery.
- Video processing, video playback synchronization, or broadcast seeking (excluded by design).

## 8. Product success criteria (initial, to refine)

- The app can ingest or replay a match and maintain a correct current match state.
- Ask the Match answers are grounded in stored delivery/statistical data and link to the right match moment.
- Catch Me Up selects the correct event window and clearly communicates timestamp limitations.
- Smart Match Timeline creates ordered, deduplicated events and updates the UI in realtime.
- The three features reuse the shared intelligence layer rather than duplicating cricket logic.
