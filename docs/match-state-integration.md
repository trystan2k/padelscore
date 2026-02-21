# MatchState Integration Notes

This document defines the integration contract for the MatchState lifecycle: when to save, when to load, when to clear, and which upcoming tasks depend on this behavior.

## Scope

- Storage schema and APIs are provided by `utils/match-state-schema.js` and `utils/match-storage.js`.
- Existing runtime flow in `page/game.js` and `page/index.js` remains source of truth for lifecycle timing.
- This note is implementation guidance for Taskmaster subtask 11.7.

## Persistence Lifecycle

| Lifecycle moment | API call | Why it happens | Expected behavior |
| --- | --- | --- | --- |
| App/page startup (home/game init) | `loadMatchState()` | Restore last active session after app relaunch/background | Return valid `MatchState` or `null`; invalid payloads fail safe (`null`) |
| After each scoring mutation | `saveMatchState(state)` | Prevent point loss from interruption between taps | Persist newest in-memory state snapshot |
| After set completion | `saveMatchState(state)` | Preserve `setsWon`, `setHistory`, and next-set reset | Persist immediately after set bookkeeping |
| After match completion | `saveMatchState(state)` | Preserve finished status for summary/resume rules | Persist with `status: 'finished'` before navigation |
| Lifecycle interruption (`onHide`, fallback `onDestroy`) | `saveMatchState(state)` | Cover background/suspend/exit paths | Save latest valid runtime state idempotently |
| New match flow / explicit reset | `clearMatchState()` | Remove stale session so setup starts fresh | Delete `ACTIVE_MATCH_SESSION` (or write empty fallback) |

## Save/Load/Clear Rules

### Save (`saveMatchState`)

Save after every state transition that changes gameplay:

1. point added/removed
2. set completed
3. match marked finished
4. page lifecycle hide/destroy

Do not defer save until navigation only. Navigation saves are a safety net, not the primary persistence trigger.

### Load (`loadMatchState`)

Load at runtime bootstrap points:

1. home page initialization/onShow to decide whether Resume is visible
2. game page initialization when runtime state is missing
3. post-undo restore flows that rebuild state from persistence (if runtime stack is unavailable)

If `loadMatchState()` returns `null`, initialize a fresh state via `createDefaultMatchState()` (or existing runtime initializer until full migration).

### Clear (`clearMatchState`)

Clear only on intentional session reset:

1. user starts a new match from Home
2. user starts a new match from Summary
3. hard-reset/cleanup flows

Do not clear when match finishes; finished state must remain available until downstream UI (Summary/Home) consumes it.

## Integration Examples

### Game page scoring and lifecycle persistence

```js
import { saveMatchState } from '../utils/match-storage.js'

function persistAndRender(nextState) {
  this.updateRuntimeMatchState(nextState)
  this.renderGameScreen()
  void saveMatchState(nextState)
}

onHide() {
  const state = this.getRuntimeMatchState()
  void saveMatchState(state)
}
```

### Home page resume decision

```js
import { loadMatchState } from '../utils/match-storage.js'

async function refreshSavedMatchState() {
  const saved = await loadMatchState()
  this.savedMatchState = saved
  this.hasSavedGame = saved !== null && saved.status === 'active'
}
```

### New match reset flow

```js
import { clearMatchState } from '../utils/match-storage.js'

async function handleStartNewGame() {
  await clearMatchState()
  this.resetRuntimeMatchState()
  this.navigateToGamePage()
}
```

## Dependency Mapping

### Inbound dependencies (needed by MatchState lifecycle)

- Task 3 (`Local Storage & Persistence Layer`): provides proven storage runtime access patterns and error-safe behavior.
- Existing runtime integration points: `page/index.js` and `page/game.js` lifecycle hooks and navigation flows.

### Outbound dependencies (tasks consuming this contract)

- Task 12 (`Implement Core Persistence Service`): consumes save/load contract and validation behavior.
- Task 13 (`Implement Pre-Match Setup UI and Logic`): consumes initialization + save semantics when creating a new session.
- Task 14 (`Integrate Lifecycle Persistence Triggers`): consumes defined save trigger timing.
- Task 15 (`Update Game Screen for Set Point Display`): consumes stable set-level fields (`setsWon`, `currentSet`).
- Task 16 (`Implement Set Completion and Match Completion Logic`): consumes set history and match status persistence expectations.
- Task 18 (`Implement Match Summary Screen`): consumes finished-state and `setHistory` persistence.
- Task 19 (`Implement New Match Reset and Cleanup`): consumes clear/reset semantics and storage key stability.

## State Flow Diagram

```text
User action (score/set/match) -> Runtime MatchState update -> saveMatchState()
                                                      |
Lifecycle hide/destroy ------------------------------+

App launch/home/game init -> loadMatchState() -> valid? yes -> hydrate runtime
                                               -> valid? no  -> create default runtime

Start new match/reset -> clearMatchState() -> create fresh runtime state
```

## Notes for Incremental Adoption

- Current pages still use legacy `saveState/loadState/clearState` in `utils/storage.js`.
- Migration to `saveMatchState/loadMatchState/clearMatchState` should be done in Task 12+ to avoid mixed contracts.
- During transition, keep behavior equivalent: fail-safe loads, idempotent saves, explicit clears.
