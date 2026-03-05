# PRD - Manual Match Finish with Coach/Whistle Confirmation

**Version:** 1.0 | **Updated:** 2026-03-05 | **Task:** #67

> **Note:** For confirmed product decisions, see [PRD-Review.md](./PRD-Review.md) - the authoritative source for all confirmed decisions.

## 1. Overview

### 1.1 Feature Name

Manual Match Finish (time-limit support) with 2-tap confirmation.

### 1.2 Purpose

Players sometimes stop a match because the play-time limit is reached before the configured number of sets is completed. The app must allow ending the match from the Game screen using the current set-level score, while preserving the same post-finish lifecycle already used for normal scoring-based completion.

### 1.3 Target Screens

- `page/game`
- `page/summary`
- `page/history`
- `page/history-detail`

---

## 2. Problem Statement

Today, match completion is primarily driven by scoring flow. For timed sessions, users need a safe, intentional way to end the match with the current scoreboard and still get all expected behavior:

- Open Summary
- Persist finished match state
- Save match to history
- Remove the match from resumable current session

---

## 3. Goals and Non-Goals

### 3.1 Goals

- Add a manual finish action in Game footer.
- Prevent accidental finish using an explicit 2-step confirmation.
- Keep winner/tie calculation deterministic and simple.
- Preserve parity with existing finish lifecycle.
- Persist and display partial final set score (set games only).

### 3.2 Non-Goals

- No point-level persistence/display for incomplete game (15/30/40/Ad).
- No new analytics model for finish reason.
- No changes to scoring rules.

---

## 4. User Stories

- As a player, when time is over, I can finish the match from Game screen.
- As a player, I must confirm manual finish so I do not end the match by mistake.
- As a player, after manual finish I see Summary and the match appears in History exactly like a normal finished match.
- As a player, if sets are tied at finish time, I see a tie result.

---

## 5. Functional Requirements

### 5.1 Footer Action Button

- Add a new icon button in `page/game` footer, side-by-side with Home.
- Default icon: `coach-icon.png`.
- Confirm icon: `whistle-icon.png`.
- Use target assets:
  - `assets/gtr-3/coach-icon.png`
  - `assets/gtr-3/whistle-icon.png`
  - `assets/gts-3/coach-icon.png`
  - `assets/gts-3/whistle-icon.png`

### 5.2 Two-Tap Confirmation Flow

First tap on coach icon:

- Switch icon to whistle.
- Show toast prompting user to tap again to finish with current score.
- Start a 3-second confirmation window.

Second tap on whistle icon within 3 seconds:

- Confirm and finish the match.

If no second tap within 3 seconds:

- Auto-reset icon back to coach.
- Exit confirmation mode.

### 5.3 Manual Finish State Rules

When manual finish is confirmed:

- Use current runtime state as source.
- Append current in-progress set games to `setHistory` as final snapshot.
- Mark match `status` as `finished`.
- Evaluate winner using sets won only:
  - Team A wins if `setsWon.teamA > setsWon.teamB`
  - Team B wins if `setsWon.teamB > setsWon.teamA`
  - Tie if equal

### 5.4 Tie Rules

- If sets are equal at finish time, treat result as tie.
- Summary text must use localized tie copy (for example: `Tied game`).
- Tie result must still include set history lines, including final partial set snapshot.

### 5.5 Lifecycle Parity with Normal Finish

Manual finish must behave the same as scoring-based finish in lifecycle outcomes:

- Navigate to Summary screen.
- Persist finished match state.
  - **Note:** Persistence triggered via `onDestroy()` in Zepp OS v1.0
  - See [PRD-Review.md](./PRD-Review.md) Section 1, Decision 4
- Save match to history.
- Ensure no resumable active match appears on Home.

### 5.6 Localization

- Add and use key `summary.tiedGame` in:
  - `page/i18n/en-US.po`
  - `page/i18n/pt-BR.po`
  - `page/i18n/es-ES.po`

---

## 6. Edge Cases

- Prevent duplicate append of current set snapshot if action is triggered twice.
- Ensure confirmation timer is cleared on navigation and `onDestroy()`.
  - **Note:** `onDestroy()` is the only cleanup lifecycle in Zepp OS v1.0
  - See [PRD-Review.md](./PRD-Review.md) Section 1, Decision 4
- If match is already finished, manual finish action should be no-op.
- If score data is partially missing, fallback safely without crashing.

---

## 7. Acceptance Criteria

1. Game footer shows Home icon and Coach icon side-by-side.
2. First tap on Coach:
   - icon changes to Whistle,
   - confirmation toast appears,
   - 3-second confirmation window starts.
3. Second tap within 3 seconds finishes match immediately.
4. If second tap does not happen within 3 seconds, icon returns to Coach.
5. Manual finish winner is based only on `setsWon`.
6. Equal sets are treated as tie.
7. Summary shows localized tie message for tie results.
8. Summary/History set lines include completed sets and current partial set snapshot.
9. Existing scoring-based completion behavior remains unchanged.

---

## 8. Test Strategy

### 8.1 Game Screen Tests

Update `tests/game-screen-layout.test.js` to validate:

- Footer icon count/order after adding coach icon.
- Default coach icon render.
- First tap swaps to whistle and shows toast.
- Second tap within 3 seconds triggers finish transition.
- Timeout resets icon without finishing.

### 8.2 Summary Tests

Update `tests/summary-screen.test.js` to validate:

- Tie result renders `summary.tiedGame`.
- Set history includes final partial set snapshot.

### 8.3 Full Gate

- Run `npm run complete-check`.

---

## 9. Task Management Reference

- Taskmaster task: `#52`
- Title: Add coach-to-whistle two-tap manual finish flow with 3-second confirmation and tie-aware summary output
