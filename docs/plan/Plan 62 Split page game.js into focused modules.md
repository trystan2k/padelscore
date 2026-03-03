## Task Analysis
- Main objective: Refactor `page/game.js` into focused modules (`logic`, `ui-binding`, `persistence`) using a coordinator pattern while preserving all current gameplay, persistence, and UI behavior (pure refactor, no intentional UX/behavior changes).
- Identified dependencies: Completed Task 54 (`utils/active-session-storage.js` / `utils/match-storage.js` unified APIs) and Task 55 canonical contract (`utils/match-state-schema.js`, `docs/schema/match-session.json`); existing game flow helpers in `utils/scoring-engine.js`, `utils/history-stack.js`, `utils/validation.js`, and `page/score-view-model.js`; regression harnesses in `tests/game-screen-layout.test.js` and `tests/edge-case-handling.test.js` that dynamically rewrite `page/game.js` imports.
- System impact: High on game-screen runtime orchestration (scoring, undo/remove, manual finish confirmation, transition to summary/home, runtime autosave queue), medium on persistence restore and teardown safety, and medium on test harness plumbing because data-URL import rewriting must include any new module imports.

## Chosen Approach
- Proposed solution: Use a boundary-first incremental extraction: (1) audit and lock seams, (2) extract pure game-state logic functions to `page/game/logic.js`, (3) extract persistence contract/adapter helpers to `page/game/persistence.js`, (4) extract rendering + widget binding into `page/game/ui-binding.js`, and (5) reduce `page/game.js` to a thin coordinator that wires page lifecycle, module calls, and state ownership.
- Justification for simplicity: Deepthink considered three options: A) big-bang rewrite of `page/game.js` into all-new architecture, B) incremental seam extraction with unchanged method semantics, C) event-bus/state-machine redesign; B is the simplest effective option because it keeps behavior-parity risk lowest, preserves existing test assumptions, and avoids introducing new architectural concepts not required by Task 62.
- Components to be modified/created: Create `page/game/logic.js`, `page/game/persistence.js`, and `page/game/ui-binding.js`; refactor `page/game.js` to coordinator-only responsibilities; add/extend tests for logic and persistence contracts (expected new files like `tests/game-logic.test.js` and `tests/game-persistence.test.js`), and update dynamic-loader rewrites in `tests/game-screen-layout.test.js` and `tests/edge-case-handling.test.js` for new imports.

## Subtask 62.1 Boundary Audit (Merged)

### Scope
- Task: 62.1 (audit only)
- File audited: `page/game.js`
- Goal: identify clear extraction boundaries for `logic`, `ui-binding`, and `persistence` modules without behavior changes.

### Locked Non-Goals (Behavior Parity)
- No scoring rule changes.
- No navigation/lifecycle flow changes (`onInit`/`build`/`onDestroy`, summary/home/setup routing).
- No visual/layout/geometry changes.
- No persistence format/contract changes (must remain compatible with Task 54/55 storage contract).

### Boundary Map

#### 1) Logic boundary (`page/game/logic.js` target)
Pure or mostly-pure state helpers that should not depend on Zepp UI APIs:

- Top-level helpers:
  - `createCurrentSetSnapshot`
  - `createManualFinishedMatchStateSnapshot`
  - `clearWinnerMetadata`
  - `applyWinnerMetadata`
  - `didMatchTransitionToFinished`
  - `didMatchTransitionFromFinished`
  - `isValidRuntimeMatchState`
  - `isHistoryStackLike`
  - `isSameMatchState`
  - `getScoringTeamForTransition`
  - `popHistorySnapshotsInOrder`
  - `restoreHistorySnapshots`

Logic-heavy coordinator methods to split into pure helpers in later subtasks:
- `removePointForTeam` (timeline rebuild algorithm can be extracted as a pure function; coordinator keeps app/globalData wiring).
- `isScoringInteractionDebounced` (pure check; coordinator keeps timestamp state).

#### 2) Persistence boundary (`page/game/persistence.js` target)
Session normalization, mapping, and storage adapter behavior:

- Top-level helpers:
  - `isPersistedMatchStateActive`
  - `mergeRuntimeStateWithPersistedSession`
  - `createPersistedMatchStateSnapshot`
  - `serializeMatchStateForComparison`

Coordinator methods that should call persistence adapter functions:
- `validateSessionAccess`
- `ensureRuntimeState`
- `saveCurrentRuntimeState`
- `enqueueRuntimeStatePersistence`
- `scheduleRuntimeStatePersistenceDrain`
- `clearRuntimeStatePersistenceTimer`
- `drainRuntimeStatePersistenceQueue`
- `persistRuntimeStateSnapshot`
- `handleLifecycleAutoSave`

#### 3) UI binding boundary (`page/game/ui-binding.js` target)
All rendering and Zepp widget creation/update logic:

- UI render methods:
  - `renderGameScreen`
  - `renderHeaderElements`
  - `renderActiveState`
  - `renderScoreButton`
  - `renderMinusButton`
  - `renderFooterElements`

- UI primitives currently embedded in page object:
  - `clearWidgets`
  - `createWidget`

- UI-related constants/config to migrate with rendering:
  - `GAME_LAYOUT`
  - `FOOTER_ICON_BUTTON_OFFSET`

### Coordinator Ownership That Stays in `page/game.js`
Orchestration and side-effect boundaries that should remain in the coordinator after split:

- Lifecycle and wiring: `onInit`, `build`, `onDestroy`.
- Navigation and access gating: `navigateToSetupPage`, `navigateToSummaryPage`, `navigateToHomePage`, `handleBackToHome`, `validateSessionAccess` result handling.
- Device/runtime side effects: `registerGestureHandler`, `unregisterGestureHandler`, `keepScreenOn`, `releaseScreenOn`.
- Interaction orchestration: `executeScoringAction`, `persistAndRender`, handler methods (`handleAddPointForTeam`, `handleRemovePointForTeam`, etc.).
- Runtime-owned mutable state (`this.*` timers/flags/signatures) and `app.globalData` wiring.

### Shared State + Seam Risks To Preserve
- `this.persistedSessionState` is used by both render view-model creation and persistence writes; extraction must keep update order unchanged.
- `this.manualFinishConfirmMode` controls footer icon state and confirm flow timing; UI extraction must preserve timer-driven rerender behavior.
- `this.lastPersistedRuntimeStateSignature` dedupes persistence writes; must remain hot-path safe and semantically identical.
- `app.globalData.matchState` and `app.globalData.matchHistory` remain coordinator-owned; extracted logic should receive data and return results rather than mutate globals directly.

### Stage Output
- This subtask is documentation-only.
- No runtime code changes were required for 62.1.

## Implementation Steps
1. Subtask 62.1 - Audit `page/game.js` boundaries and produce a function ownership map: classify current functions into pure logic (state transforms/comparisons), persistence adapter/serialization, and UI rendering/binding; lock explicit non-goals (no scoring-rule changes, no navigation/lifecycle behavior changes, no visual changes).
2. Establish a behavior-parity baseline before refactor by running focused existing regressions (`tests/game-screen-layout.test.js`, `tests/edge-case-handling.test.js`, plus any persistence/session tests touching game resume) and capture expected outcomes as a checkpoint reference for rollback decisions.
3. Subtask 62.2 - Create `page/game/logic.js` with pure functions extracted from `page/game.js` (state validation, match-finish transition predicates, manual-finish snapshot generation, score-transition inference, history snapshot rebuild helpers); keep function bodies semantically identical and avoid side effects or runtime globals.
4. Add/adjust unit tests for `page/game/logic.js` contract: verify point/remove transition inference, finished/unfinished transitions, manual finish snapshot/winner metadata behavior, and history reconstruction edge cases; preserve existing behavior assertions rather than redefining domain rules.
5. Subtask 62.4 - Create `page/game/persistence.js` as the active-session adapter boundary over Task 54/55 APIs, exposing `loadState` and `saveState` plus pure normalization/snapshot helpers needed by coordinator; keep canonical schema compatibility and current fallback semantics for invalid/corrupt runtime state.
6. Add persistence contract tests for `page/game/persistence.js`: cover runtime<->canonical mapping, finished/active status preservation, winner metadata consistency, safe handling of invalid runtime state, and save/load parity with unified active-session behavior.
7. Subtask 62.3 - Create `page/game/ui-binding.js` by extracting layout constants and render/bind functions (header, score area, minus buttons, footer/manual-finish icon state), driven by injected callbacks and state input from coordinator; preserve existing widget geometry and event targets to avoid UI drift.
8. Subtask 62.5 - Refactor `page/game.js` into coordinator pattern: keep lifecycle methods (`onInit`, `build`, `onDestroy`) and orchestration concerns (timers, debounce windows, navigation guards, session access guard), delegate logic/persistence/render work to new modules, and preserve current public method names used by tests.
9. Update test harness import-rewrite logic in `tests/game-screen-layout.test.js` and `tests/edge-case-handling.test.js` to resolve any new `page/game/*.js` imports when loading `page/game.js` via data URLs, then run full game-screen regression tests to verify unchanged behavior.
10. Elevated-risk mitigation + rollback: if parity breaks after coordinator wiring, rollback in layers (first revert `page/game.js` delegation while keeping new modules/tests, then selectively re-enable one module at a time) and use baseline checkpoints to localize whether regression originates in logic extraction, persistence mapping, or UI-binding callback wiring.
11. Execute full verification gate: run targeted new tests, run simulator manual checks for scoring/set/match completion and restore-from-persistence flows, and finally run `npm run complete-check` as the project QA gate.

## Validation
- Success criteria: `page/game.js` is reduced to coordinator responsibilities; new modules (`logic`, `ui-binding`, `persistence`) exist with clear boundaries; no intentional behavior/UI changes are introduced; logic and persistence contracts are covered by unit tests; simulator validation confirms unchanged scoring/set/match flow and persistence restore; `npm run complete-check` passes.
- Checkpoints: Pre-implementation checkpoint confirms dependency readiness (Tasks 54/55 done), boundary map, and baseline test results; during-implementation checkpoint A validates logic-module parity tests before coordinator changes, checkpoint B validates persistence contract tests before wiring saves/loads, checkpoint C validates UI-binding extraction via existing layout/edge-case regressions, and includes rollback trigger (restore previous `page/game.js` orchestration if any parity test fails); post-implementation checkpoint validates simulator smoke scenarios and final QA command success.
