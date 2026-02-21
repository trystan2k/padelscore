---
title: Task 13 Implement Pre-Match Setup UI and Logic.md
type: note
permalink: development-logs/task-13-implement-pre-match-setup-ui-and-logic.md
---

# Development Log: Task 13

## Metadata
- Task ID: 13
- Date (UTC): 2026-02-21T00:00:00Z
- Project: padelscore
- Branch: n/a
- Commit: n/a

## Objective
- Implement a Pre-Match Setup flow: allow selection of 1 / 3 / 5 sets, initialize a schema-valid active match session, persist it before navigating to gameplay, and guard game entry against missing/invalid sessions.

## Implementation Summary
- Subtask 13.1 (Setup UI): Added `page/setup.js` implementing a three-option set selector (1/3/5) with visible selection state and a `Start Match` button that is disabled until a selection is made. Followed existing widget/layout conventions from `page/index.js`.
- Subtask 13.2 (Initializer): Added `utils/match-session-init.js` with `initializeMatchState(setsToPlay)` which validates allowed inputs (1/3/5), computes `setsNeededToWin = Math.ceil(setsToPlay / 2)`, and returns a schema-valid active match state reusing the shape from `utils/match-state-schema.js`.
- Subtask 13.3 & 13.4 (Persistence + Navigation): Implemented `save-then-verify` flow in setup confirm handler: the handler prevents duplicate submissions, calls `initializeMatchState`, calls `saveMatchState`, then `loadMatchState` immediately to verify persistence. Navigation to `page/game` occurs only after verification succeeds; on failure an inline toast-style error is shown and the UI remains on setup.
- Subtask 13.5 (Game Guard): Added an early guard in `page/game.js` (`hasValidActiveSession`) that runs on page init/show and redirects to `page/setup` when no valid active persisted session is found. Guard logic is encapsulated for ease of later rollback.
- Subtask 13.6 (Tests): Added unit tests for `initializeMatchState` (1/3/5 and invalid inputs), added integration tests for setup-page UX (selection, disabled start, persistence-before-navigation ordering), updated `tests/home-screen.test.js` to expect navigation to setup for `Start New Game`, and added game guard tests validating redirect when no active session exists.

## Files Changed
- app.json (register setup route for gtr-3 and gts-3 targets)
- page/index.js (route Start New Game -> page/setup)
- page/setup.js (new)
- page/game.js (guard added)
- utils/match-session-init.js (new initializer)
- utils/match-storage.js (existing file exercised; small fix to ensure read-after-write consistency)
- page/i18n/en-US.po (new keys for setup labels and errors)
- tests/home-screen.test.js (updated expectation)
- tests/setup-page.test.js (new)
- tests/initializeMatchState.test.js (new)
- tests/game-guard.test.js (new)

## Key Decisions
- Implement an isolated Match Setup page (option C from planning) to minimize risk and keep migration scope small.
- Enforce save-then-verify-before-navigation to prevent entering gameplay with an unsaved session.
- Encapsulate guard and init logic for easier future rollback or migration to a global session manager.
- Support only 1/3/5 sets; invalid values are rejected early by the initializer.

## Validation Performed
- npm run test: initial run failed due to guard timing — some integration tests showed navigation occurring before the persistence verification completed.
- Fix applied: made the setup confirm handler fully sequential and await read-after-write verification; ensured duplicate-submission prevention and button disabled state during async work. Re-ran tests.
- npm run test: final run passed (all new and updated test suites green).

## Code Review Findings and Fixes Applied
- Finding: race condition where navigation could occur before verification completed. Fix: tightened async flow in setup confirm handler to await saveMatchState and loadMatchState verification; added explicit lock to prevent duplicate submissions.
- Finding: missing i18n keys for setup labels/errors in en-US. Fix: added required keys to page/i18n/en-US.po and wired labels in page/setup.js.
- Finding: route registration missing for one of the device targets in app.json. Fix: ensured both gtr-3 and gts-3 include the setup page entry.
- Finding: tests assumed immediate sync persistence. Fix: updated tests to await verification and to mock storage layer where appropriate to assert ordering.

## Risks and Follow-ups
- Risk: future migration to a global session manager may require refactor of guard/init locations—kept encapsulation to minimize effort.
- Follow-up: monitor real-device timing on low-end devices; if flakiness appears, consider adding a lightweight persistent-write confirmation API on the storage layer.

## Plan Reference
- Planning context and original plan: /Users/trystan2k/Documents/Thiago/Repos/padelscore/docs/plan/Plan 13 Implement Pre-Match Setup UI and Logic.md

## Final Status Outcome
- success
