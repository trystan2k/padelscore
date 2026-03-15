# Match State Integration

**Version:** 1.2 | **Updated:** 2026-03-15 | **Task:** #79

This document defines the integration contract for the active match lifecycle: when to save, when to load, when to clear, and which runtime assumptions mainline keeps for the Zepp OS API 3.6+ app line.

## Scope

- Storage schema and APIs are provided by `utils/match-state-schema.js`, `utils/active-session-storage.js`, and `utils/persistence.js`.
- Existing runtime flow in `page/game.js` and `page/index.js` remains the source of truth for lifecycle timing.
- This note describes the current mainline contract, not the old Zepp OS 1.0 migration path.

## Persistence Lifecycle

| Lifecycle moment | API call | Why it happens | Expected behavior |
| --- | --- | --- | --- |
| App/page startup (home/game init) | `getActiveSession()` | Restore last active session after relaunch/background | Return valid `MatchState` or `null`; invalid payloads fail safe to `null` |
| After each scoring mutation | active-session save path | Prevent point loss from interruption between taps | Persist the latest accepted active-session snapshot |
| After set completion | active-session save path | Preserve `setsWon`, `setHistory`, and next-set reset | Persist immediately after set bookkeeping |
| After match completion | finish + clear active-session flow | Preserve summary data while clearing stale active resume state | Finished match can move to summary/history without leaving a fake active session |
| Lifecycle interruption (`onDestroy`) | emergency active-session persistence | Cover suspend/exit paths | Persist the latest active schema snapshot best-effort |
| New match flow / explicit reset | `clearActiveSession()` | Remove stale session so setup starts fresh | Delete the active-session payload |

## Save/Load/Clear Rules

### Save

Save after every state transition that changes gameplay:
1. point added or removed
2. set completed
3. active-session state changes that affect resume behavior
4. lifecycle cleanup paths that must preserve the latest active state

### Load

Load at runtime bootstrap points:
1. home page initialization to decide whether Resume is visible
2. game page initialization when runtime state is missing
3. restore flows that rebuild runtime state from persisted active-session data

If session load returns `null`, fail safe:
- hide Resume on Home
- do not navigate to Game from Resume
- keep runtime manager unchanged until a new match starts

### Clear

Clear only on intentional session reset:
1. user starts a new match from Home
2. user starts a new match from Summary
3. explicit cleanup flows

Do not keep old Zepp OS 1.x compatibility stores in sync with the active-session contract.

## Integration Examples

### Game page persistence

```js
import { saveActiveSession } from '../utils/active-session-storage.js'

function persistAndRender(nextState) {
  this.updateRuntimeMatchState(nextState)
  this.renderGameScreen()
  saveActiveSession(nextState)
}
```

### Home page resume decision

```js
import { getActiveSession } from '../utils/active-session-storage.js'

function refreshSavedMatchState() {
  const saved = getActiveSession()
  this.savedMatchState = saved
  this.hasSavedGame = saved !== null && saved.status === 'active'
}
```

### New match reset flow

```js
import { clearActiveSession } from '../utils/match-storage.js'

function handleStartNewGame() {
  clearActiveSession()
  this.resetRuntimeMatchState()
  this.navigateToGamePage()
}
```

## Notes

- Mainline is LocalStorage-first for the Zepp OS 3.x app line.
- New runtime code should prefer the active-session and persistence utilities already built on the Zepp OS 3.x storage path.
- Historical docs that mention Zepp OS 1.0 lifecycle or dual-write migration behavior should be treated as archive context unless they are explicitly refreshed.
