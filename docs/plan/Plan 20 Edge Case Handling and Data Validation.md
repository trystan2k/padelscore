# Plan – Task 20: Edge Case Handling and Data Validation

**Task ID**: 20  
**Title**: Edge Case Handling and Data Validation  
**Status**: in-progress  
**Priority**: medium  
**Dependencies**: Task 12 (Persistence Service – DONE), Task 17 (Home Screen Resume Logic – DONE)  
**Plan Created**: 2026-02-22  

---

## Task Analysis

### Main Objective
Harden the app against three specific robustness scenarios:
1. User exits immediately after setup with 0 points played → Resume must still appear on Home.
2. Corrupted or partial storage data → Home must load safely with Resume hidden.
3. Game screen must not render or crash if runtime state is absent or session is invalid.

### Identified Dependencies
- `utils/match-storage.js` – `loadMatchState`, `saveMatchState`, `clearMatchState`
- `utils/match-state-schema.js` – `isMatchState`, `deserializeMatchState`, `initializeMatchState`
- `utils/match-session-init.js` – `initializeMatchState` (creates persisted state from setup)
- `page/index.js` – Home screen resume visibility logic
- `page/game.js` – Session validation, runtime state guards, render pipeline
- `tests/match-storage.test.js` – Existing persistence tests
- `tests/home-screen.test.js` – Existing home screen tests
- `tests/game-screen-layout.test.js` – Existing game screen tests

### System Impact
**Low-risk**: All changes are defensive/additive (guards and tests). No business logic is altered.  
No changes to storage schema, scoring engine, or navigation flow.

---

## Deep Think: Current State vs. Gaps

### What Already Works (verified by code inspection + existing tests)

| Concern | Current Code | Evidence |
|---------|-------------|----------|
| `loadMatchState` returns null for corrupted JSON | `try/catch` + `deserializeMatchState` → returns `null` | `match-storage.test.js` line 210–238 |
| `loadMatchState` returns null for partial data | `isMatchState()` guards all required fields | `match-storage.test.js` line 222–258 |
| Home screen hides Resume for invalid payload | `isActivePersistedMatchState()` check in `refreshSavedMatchState()` | `home-screen.test.js` line 404–431 |
| Home screen hides Resume for load errors | try/catch in `refreshSavedMatchState()` | `home-screen.test.js` line 404–431 |
| Game screen `build()` does not render without session | `if (!this.isSessionAccessGranted) return` | `game.js` line 571–576 |
| Game screen `getRuntimeMatchState()` is null-safe | Falls back to `createInitialMatchState()` | `game.js` line 741–753 |
| 0-point initial state is schema-valid | `initializeMatchState` uses `createDefaultMatchState()` which sets all required fields | `match-session-init.js` line 27–58 |

### Identified Gaps

#### Gap 1 – No end-to-end test for 0-point resume (Scenario 1)
The code logic is correct but the integration path `initializeMatchState → saveMatchState → loadMatchState → isActivePersistedMatchState = true → Resume visible` has **no explicit test**. A regression could silently break this.

**Risk**: Medium – this is the primary "happy path" for resume after a new game is set up but no points have been played.

#### Gap 2 – `renderGameScreen()` has no session guard (belt-and-suspenders)
`build()` guards with `isSessionAccessGranted`, but `renderGameScreen()` itself does not. If `renderGameScreen()` is ever called directly (e.g., from a future lifecycle hook, or from an `onShow` race) before session validation completes, it could attempt to render with an uninitialised `persistedSessionState`.

**Risk**: Low in current code, but **defensive coding best practice** requires a guard directly in the render function.

#### Gap 3 – No test for game screen redirect when session is invalid
`game.js:hasValidActiveSession()` calls `loadMatchState()` and redirects to Setup if the result is null, finished, or throws. This entire redirect path is **not tested**. All existing `game-screen-layout.test.js` tests manually set `isSessionAccessGranted = true` to bypass it.

**Risk**: Medium – a regression in `validateSessionAccess` could cause the game screen to crash or render blank rather than safely redirecting.

#### Gap 4 – No test for each specific corruption variant in the game screen path
While home screen corruption is tested, the game screen's `hasValidActiveSession()` flow has no coverage for: null return, finished state, thrown exception. These are separate code paths from the home screen's `refreshSavedMatchState()`.

---

## Chosen Approach

### Proposed Solution
1. **One focused code change** in `page/game.js`: add a session guard at the top of `renderGameScreen()`.
2. **One new test file** `tests/edge-case-handling.test.js` covering all four gaps systematically.
3. **No changes** to `utils/match-storage.js` or `utils/match-state-schema.js` – they are already robust.

### Justification for Simplicity
- The persistence layer is already hardened. Touching it risks introducing regressions in well-tested code.
- The `renderGameScreen` guard is a single `if` statement – zero complexity cost.
- Grouping new tests in a dedicated file keeps existing test files focused and avoids merge conflicts with future layout/home test additions.
- All four gaps can be closed with ~10–12 focused test cases following existing patterns.

### Components to be Modified/Created

| File | Action | Description |
|------|--------|-------------|
| `page/game.js` | Modify | Add session guard in `renderGameScreen()` |
| `tests/edge-case-handling.test.js` | Create | New test file for all four identified gaps |

---

## Implementation Steps

### Step 1 – Confirm Existing Tests Pass (Pre-condition)
```bash
npm run test
```
All existing tests must be green before any changes. If failures exist, diagnose before proceeding.

**Checkpoint**: All tests pass. ✅

---

### Step 2 – Add Session Guard in `renderGameScreen()` (`page/game.js`)

**Location**: `page/game.js`, inside `renderGameScreen()`, at the very top (after the `hmUI === undefined` guard).

**Current code** (lines 1226–1232):
```js
renderGameScreen() {
  if (typeof hmUI === 'undefined') {
    return
  }

  const matchState = this.getRuntimeMatchState()
  // ...
}
```

**Modified code** (add the session guard right after the `hmUI` guard):
```js
renderGameScreen() {
  if (typeof hmUI === 'undefined') {
    return
  }

  if (!this.isSessionAccessGranted) {
    return
  }

  const matchState = this.getRuntimeMatchState()
  // ...
}
```

**Why**: Belt-and-suspenders. Prevents `renderGameScreen()` from rendering with potentially null `persistedSessionState` if it is ever called before `validateSessionAccessAndRender()` completes. Matches the `build()` guard pattern already present in the same file.

**Risk**: None. Returns early without side effects. All existing tests that manually set `isSessionAccessGranted = true` before calling `renderGameScreen()` continue to work unchanged.

**Rollback**: Delete the two new lines.

---

### Step 3 – Create `tests/edge-case-handling.test.js`

Create a new test file that uses the **same data-URL module loading pattern** as `tests/home-screen.test.js` and `tests/game-screen-layout.test.js`.

The file reuses the same helpers (`createHmUiRecorder`, `createPageInstance`, `loadHomePageDefinition`, `loadGamePageDefinition`) that are already established in those test files. To avoid code duplication, copy only what is needed for each set of scenarios.

**Structure**:

```
tests/edge-case-handling.test.js
  ├── [Home screen section – Scenario 1: 0-point resume]
  │     Test 1: initializeMatchState(3) produces schema-valid 0-point active state
  │     Test 2: loadMatchState correctly loads and validates a 0-point active state
  │     Test 3: Home screen shows Resume when storage contains 0-point active state
  │
  ├── [Home screen section – Scenario 2: Corrupt/partial data]
  │     Test 4: Home screen hides Resume for state with valid status but missing schemaVersion
  │     Test 5: Home screen hides Resume for state with all fields except setHistory
  │     Test 6: Home screen hides Resume for state where currentSet.number is 0 (invalid positive int)
  │
  └── [Game screen section – Scenario 3: Session guard]
        Test 7: Game screen redirects to setup when loadMatchState returns null
        Test 8: Game screen redirects to setup when loadMatchState returns finished state
        Test 9: Game screen redirects to setup when loadMatchState throws
        Test 10: Game screen renderGameScreen() is a no-op when isSessionAccessGranted is false
        Test 11: Game screen build() is a no-op when isSessionAccessGranted is false (regression)
```

#### Detailed Test Descriptions

**Test 1 – `initializeMatchState(3)` produces schema-valid 0-point active state**
- Call `initializeMatchState(3)` directly (no mocking needed)
- Import `isMatchState` from `utils/match-state-schema.js`
- Assert `isMatchState(result)` is `true`
- Assert `result.status === 'active'`
- Assert `result.currentGame.points.teamA === 0`
- Assert `result.currentGame.points.teamB === 0`
- Assert `result.currentSet.number === 1`
- Assert `result.setHistory` is empty array

**Test 2 – `loadMatchState` correctly loads and validates a 0-point active state**
- Use `MatchStorage` with an in-memory adapter
- Call `await matchStorage.saveMatchState(initializeMatchState(3))`
- Call `await matchStorage.loadMatchState()`
- Assert result is not null
- Assert result.status === 'active'
- Assert result passes `isMatchState()`
- (This confirms the save → load roundtrip for 0-point state)

**Test 3 – Home screen shows Resume when storage contains 0-point active state**
- Use `runHomePageScenario` pattern from `home-screen.test.js`
- Provide `matchStorageLoadResponses` with the serialized output of `initializeMatchState(3)`
- Assert that both `'home.startNewGame'` and `'home.resumeGame'` buttons are visible

**Test 4 – Home screen hides Resume for partial state missing schemaVersion**
- Craft payload: `JSON.stringify({ status: 'active', setsToPlay: 3, setsNeededToWin: 2, setsWon: { teamA: 0, teamB: 0 }, currentSet: { number: 1, games: { teamA: 0, teamB: 0 } }, currentGame: { points: { teamA: 0, teamB: 0 } }, setHistory: [], updatedAt: Date.now() })`  
  (All fields of a V0 state – missing `schemaVersion`)
- Use `runHomePageScenario` pattern
- Assert only `'home.startNewGame'` is visible (no Resume)

**Test 5 – Home screen hides Resume for state missing setHistory**
- Craft payload missing the `setHistory` field
- Assert only `'home.startNewGame'` is visible

**Test 6 – Home screen hides Resume for state with currentSet.number = 0**
- Craft payload with `currentSet.number: 0` (fails `isPositiveInteger`)
- Assert only `'home.startNewGame'` is visible

**Test 7 – Game screen redirects to setup when `loadMatchState` returns null**
- Use `runWithRenderedGamePage`-style setup but do NOT set `isSessionAccessGranted = true`
- Mock `matchStorage.adapter.load` to return `null`
- Call `page.onInit()` and wait for async updates
- Assert `navigateToSetupPage()` was called (i.e., `hmApp.gotoPage({ url: 'page/setup' })` was called)
- Assert `page.isSessionAccessGranted === false`

**Test 8 – Game screen redirects to setup when `loadMatchState` returns finished state**
- Same setup but mock adapter returns a serialized finished state  
  `JSON.stringify({ ...initializeMatchState(3), status: 'finished' })`
- Assert redirect to setup called
- Assert `isSessionAccessGranted === false`

**Test 9 – Game screen redirects to setup when `loadMatchState` throws**
- Mock adapter.load to `throw new Error('storage unavailable')`
- Assert redirect to setup called
- Assert `isSessionAccessGranted === false`

**Test 10 – `renderGameScreen()` is a no-op when session is not granted**
- Load game page definition
- Set `page.isSessionAccessGranted = false`  
  (but set `hmUI`, `hmSetting`, `getApp` so it could render if not guarded)
- Call `page.renderGameScreen()`
- Assert zero widgets were created (no side effects)

**Test 11 – `build()` returns early without rendering when session not yet granted**
- Load game page definition
- Ensure `isSessionAccessGranted` remains `false` after `onInit()`  
  (done by mocking `matchStorage.adapter.load` to return `null` and using stub `hmApp.gotoPage`)
- Call `page.build()`
- Assert zero game widgets were created

---

### Step 4 – Run Tests to Verify
```bash
npm run test
```
All existing tests plus all new tests must pass.

**Checkpoint**: Green. If any new test fails, revisit Step 2 or 3 to fix the implementation/test.

---

### Step 5 – Verify QA Scenarios Manually (On Device / Simulator)

**QA Scenario 1: Setup → Back → Resume**
1. Open app → Home screen
2. Tap "Start New Game" (confirm if asked) → Setup screen
3. Select "3 Sets" → Tap "Start Match" → Game screen appears with 0-0
4. Press hardware Back button → Home screen
5. **Expected**: "Resume" button is visible

**QA Scenario 2: Corrupt Storage → Safe Home**
1. Use Zepp OS developer tools or adb to modify the storage key `ACTIVE_MATCH_SESSION` to contain invalid JSON (e.g., `{"status":"active","broken`)
2. Open app → Home screen
3. **Expected**: No "Resume" button; app loads cleanly without crash

---

## Validation

### Success Criteria
1. `npm run test` passes with 0 failures (all 11+ new tests green, all existing tests green)
2. `page/game.js:renderGameScreen()` has the session guard in place
3. `tests/edge-case-handling.test.js` exists with all 11 test cases
4. QA Scenario 1 (0-point resume) passes on simulator/device
5. QA Scenario 2 (corrupt storage) passes on simulator/device

### Checkpoints

| Step | Gate | How to Verify |
|------|------|---------------|
| Pre-implementation | All existing tests green | `npm run test` |
| After Step 2 (code change) | No existing tests broken | `npm run test` |
| After Step 3 (new tests) | All new tests pass | `npm run test` (look for 11 new assertions) |
| Post-implementation | QA Scenario 1 | Simulator or device test |
| Post-implementation | QA Scenario 2 | Simulator or device test |

### Regression Risk Assessment

| Change | Risk | Mitigation |
|--------|------|-----------|
| Add guard in `renderGameScreen()` | Very Low | Existing tests set `isSessionAccessGranted = true` before calling render; guard only affects unsanctioned calls |
| New test file | Zero | Tests are additive only |

---

## File Reference Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `page/game.js` | Edit | +2 lines: session guard in `renderGameScreen()` |
| `tests/edge-case-handling.test.js` | Create | ~250 lines: 11 focused test cases |

---

## Notes on Non-Changes

The following were evaluated and **deliberately NOT changed**:

- **`utils/match-storage.js:loadMatchState()`** – Already fully defensive. Has try/catch, null checks, and delegates to `isMatchState()` for structural validation.
- **`utils/match-state-schema.js:deserializeMatchState()`** – Does not call `migrateMatchState()` but this is intentional: V0 states without `schemaVersion` are treated as "unknown schema" and return `null` (defaulting to no active game). The migration path exists separately via `migrateMatchState()` for explicit upgrade scenarios.
- **`page/index.js`** – Home screen is already hardened (try/catch + `isActivePersistedMatchState` guard). No changes needed.
- **`page/game.js:build()`** – Guard already present (`if (!this.isSessionAccessGranted) return`). Step 2 adds a complementary guard at the render level.
