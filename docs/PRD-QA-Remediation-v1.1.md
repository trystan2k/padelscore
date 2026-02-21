# Product Requirements Document (PRD)

## 1. Overview

### 1.1 Document Name

Padel Scoreboard - QA Reliability and Match Flow Enhancements (v1.1)

### 1.2 Background

QA validation identified reliability and match-flow gaps in the current implementation:

- Match state can be lost when the watch sleeps.
- Match state can be lost when exiting the app and returning later.
- New matches do not require set-count selection before entering the game screen.
- Set wins are not tracked as match-level set points.
- Match completion does not show a dedicated summary with per-set scores.

### 1.3 Objective

Deliver a resilient match session flow that:

- survives sleep/background/exit scenarios without score loss,
- supports explicit match format selection (1, 3, or 5 sets),
- tracks set points at match level,
- and ends with a clear summary screen.

### 1.4 Platform

- Zepp OS (Amazfit watch devices)
- Touch-first UI
- Local on-device persistence only (no cloud sync)

---

## 2. Goals and Success Criteria

### 2.1 Goals

- Guarantee active match continuity across lifecycle interruptions.
- Let users resume active matches directly from Home.
- Add pre-match setup for number of sets.
- Track both game score (within current set) and set score (within match).
- Provide a complete end-of-match summary.

### 2.2 Success Criteria

- 0 score-loss incidents in QA scenarios: sleep, app exit, and reopen.
- Resume action returns to the exact saved match state in under 1 second.
- 100% of new matches require set selection before gameplay starts.
- Match ends automatically when required set wins are reached.
- Summary screen shows all played sets with final game counts per set.

---

## 3. Scope

### 3.1 In Scope

- Persistent active match session state.
- Home Screen `Resume Game` behavior.
- New Match setup step for selecting `1`, `3`, or `5` sets.
- Match-level set point tracking.
- Match completion and summary screen.

### 3.2 Out of Scope

- Player names and roster management.
- Match history across multiple completed matches.
- Cloud sync and phone companion sync.
- Tie-break rule configuration.

---

## 4. User Stories

- As a player, I can leave the app or let the watch sleep and continue exactly where I stopped.
- As a player, I can tap `Resume Game` from Home to continue an unfinished match.
- As a player, I can choose match length (1, 3, or 5 sets) before starting.
- As a player, I can see set points (sets won) update as soon as a set is won.
- As a player, I can see a final summary showing each set's game score after match completion.

---

## 5. Functional Requirements

### FR-1: Active Match Persistence Across Lifecycle

The app must persist active match state to local storage:

- after every scoring action (add/remove point),
- after set transitions,
- when navigating away from Game,
- when app/page lifecycle events indicate interruption (sleep/background/exit paths),
- and immediately after a new match session is created.

The persisted state must include enough data to restore the exact match context, including selected set format and per-set progress.

### FR-2: Home Screen Resume Game

- Home must show `Resume Game` only when an unfinished active match exists in persistent storage.
- Tapping `Resume Game` must load the latest persisted active match and open Game in the same state.
- If no valid active session exists, `Resume Game` must be hidden.

### FR-3: Pre-Match Setup (Set Count)

- Tapping `Start New Game` must open a setup step before Game.
- User must choose number of sets: `1`, `3`, or `5`.
- Confirming setup creates a fresh active match session and navigates to Game.
- Match-winning threshold is derived from selection:
  - `1` set -> first to `1` set
  - `3` sets -> first to `2` sets
  - `5` sets -> first to `3` sets

### FR-4: Set Points and Set Progression

Game Screen must display:

- current game points (point score in current game),
- current set games (games within the current set),
- match set points (sets won by Team A and Team B).

When a team wins a set:

- that team's set points increment by one,
- final games for that set are recorded in set history,
- current set game counters reset for next set (unless match is complete).

### FR-5: Match Completion Logic

- A match is completed when a team reaches the required number of set wins based on FR-3.
- On completion, match status becomes `finished` and active scoring actions are disabled.
- Finished match state is preserved for transition into summary view.

### FR-6: Match Summary Screen

When match status is `finished`, app must show a summary screen containing:

- winner,
- final set points (Team A vs Team B),
- list of all played sets with per-set game results (example: `Set 1: 6-4`).

Summary screen actions:

- `Home` (return to Home),
- `Start New Game` (begin setup for a new match).

### FR-7: New Match Reset Rules

Starting a new match must clear prior active-session state and undo history, then initialize a new session from setup values.

---

## 6. Data Requirements

### 6.1 Session Model (Conceptual)

The persisted active session must include at minimum:

- `status`: `active` or `finished`
- `setsToPlay`: `1 | 3 | 5`
- `setsNeededToWin`: `1 | 2 | 3`
- `setsWon.teamA`, `setsWon.teamB`
- `currentSet.number`
- `currentSet.games.teamA`, `currentSet.games.teamB`
- `currentGame.points.teamA`, `currentGame.points.teamB`
- `setHistory[]` with entries:
  - `setNumber`
  - `teamAGames`
  - `teamBGames`
- `updatedAt`

### 6.2 Persistence Behavior

- Last-write-wins snapshot behavior is acceptable.
- Corrupted or incompatible persisted data must fail safely (no crash) and default to no resumable active session.

---

## 7. Navigation Flow

### 7.1 Start Flow

`Home -> Start New Game -> Match Setup (1/3/5 sets) -> Game`

### 7.2 Resume Flow

`Home (Resume visible) -> Resume Game -> Game (restored state)`

### 7.3 Completion Flow

`Game (match finished) -> Match Summary -> Home or Start New Game`

---

## 8. Non-Functional Requirements

- Reliability: no data loss in tested lifecycle scenarios (sleep, background, app exit/reopen).
- Performance: score actions and UI updates remain within existing interaction latency targets.
- Compatibility: behavior must work on supported round and square Zepp OS devices.
- Robustness: storage read/write failures must not crash the app.

---

## 9. Edge Cases

- If user leaves app before first point, created match session must still be resumable.
- If persisted state exists but is invalid/corrupted, hide Resume and allow clean new start.
- If match is finished, Resume should not restore active scoring session.
- Undo behavior is limited to active match state only.

---

## 10. Acceptance Criteria

1. Sleep/Resume Reliability
   - Given an active match, when watch enters sleep and user returns, then state is unchanged.

2. Exit/Reopen Reliability
   - Given an active match, when user exits app and reopens, then Home shows `Resume Game` and resume restores exact state.

3. Set Selection Gate
   - Given `Start New Game`, when user starts a match, then set-count selection (1/3/5) is required before Game appears.

4. Set Point Tracking
   - Given active match, when Team A or Team B wins a set, then that team's set points increment by 1 and set history captures the final set games.

5. Match Completion
   - Given selected match format, when a team reaches required set wins, then status becomes finished and summary screen is shown.

6. Summary Content
   - Given finished match, summary displays winner, final set points, and all set-level game results.

---

## 11. Test Strategy

- Unit tests: scoring transitions for set wins and match completion thresholds (1/3/5 sets).
- Unit tests: persistence serialization/deserialization including set metadata and history.
- Integration tests: Home setup/resume/completion flows.
- Lifecycle tests: save and restore across simulated hide/sleep/destroy/reopen.
- Manual QA: on real device for sleep/wake and app exit/re-entry behavior.

---

## 12. Assumptions

- Existing padel game-level scoring rules remain unchanged.
- Tie-break behavior remains as currently defined.
- Summary needs per-set game totals; point-by-point rally history is not required.

---

**End of PRD**
