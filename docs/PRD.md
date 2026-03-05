# Product Requirements Document (PRD)

**Version:** 1.1 | **Updated:** 2026-03-05 | **Task:** #67

> **Note:** For confirmed product decisions, see [PRD-Review.md](./PRD-Review.md) - the authoritative source for all confirmed decisions.

## 1. Overview

### 1.1 Product Name

Padel Buddy for Zepp OS (Amazfit Watch)

### 1.2 Purpose

The purpose of this application is to provide a **simple, fast, and reliable Padel Buddy** optimized for Amazfit smartwatches running **Zepp OS**. The app allows users to track padel match scores directly from their wrist without distractions, supporting common in-game actions such as scoring points, undoing mistakes, tracking sets, and resuming interrupted games.

### 1.3 Target Platform

- **Operating System:** Zepp OS
- **Devices:** Amazfit smartwatches (round and square screens)
- **Input:** Touch-based interaction (no keyboard)

### 1.4 Target Users

- Casual padel players
- Competitive padel players
- Coaches or spectators who want a simple score tracker

### 1.5 Design Reference

All UI and visual styling must strictly follow the provided design system and layouts:

- Design reference URL (Lovable preview):
  <https://zepp-padel-buddy.lovable.app>

- Images of the design system:
  - [Game Start](docs/images/game-start.png)
  - [Game Finish](docs/images/game-finish.png)
  - [Game Setup](docs/images/game-setup.png)
  - [Game Overview](docs/images/game-overview.png)
  - [Game Score](docs/images/game-score.png)

The design defines:

- Color palette
- Typography
- Button sizes and placement
- Screen hierarchy
- Spacing and alignment

---

## 2. Goals & Success Criteria

### 2.1 Goals

- Enable **one-tap scoring** for both teams
- Allow **undoing incorrect scores** quickly
- Clearly display **current game points and set scores**
- Support **starting new games** and **resuming ongoing games**
- Ensure the app is **usable during live play** with minimal interaction time

### 2.2 Success Criteria

- A user can score a point in under **1 second**
- A user can undo a score in under **1 second**
- No accidental navigation during scoring
- Persistent game state across app exits

---

## 3. Functional Requirements

### 3.1 Application States

The application has two primary states:

1. **Home Screen**
2. **Game Screen**

---

## 4. Home Screen

### 4.1 Purpose

The Home Screen is the entry point of the application. It allows the user to:

- Start a new game
- Resume an existing game (if one exists)

### 4.2 UI Elements

- **App Title / Logo** (as per design)
- **Primary Button:** "Start New Game"
- **Secondary Button:** "Resume Game" (only visible if a saved game exists)

### 4.3 Behavior

- If **no active or saved game exists**:
  - Only "Start New Game" is visible
- If a **saved game exists**:
  - Both "Start New Game" and "Resume Game" are visible

### 4.4 Actions

#### Start New Game

- Clears any existing saved game data
- Navigates to the **Game Screen** with scores reset

#### Resume Game

- Loads the last saved game state
- Navigates to the **Game Screen**

---

## 5. Game Screen

### 5.1 Purpose

The Game Screen is where all scoring interactions take place.

### 5.2 Core Concepts

#### Teams

- **Team A**
- **Team B**

#### Scoring Model (Padel)

- Game points: `0 → 15 → 30 → 40 → Game`
- Sets consist of multiple games
- Traditional scoring model is used for v1:
  - Deuce and advantage are enabled
  - A game is won after winning the advantage point
  - A set is won at 6 games with a minimum 2-game margin
  - At `6-6` games, a tie-break is played (first to 7 points, win by 2)

> Note: Tie-break behavior is fixed in v1. Tie-break configuration remains out of scope.

---

### 5.3 UI Elements

#### Score Display

- **Current Game Points**
  - Team A points
  - Team B points
- **Current Set Score**
  - Games won by Team A
  - Games won by Team B

#### Action Buttons (per team)

For **each team (A and B)**:

- **Add Point (+)**
- **Remove Point (−)**

#### Navigation

- **Back / Home Button**
  - Returns to Home Screen
  - Automatically saves current game state

---

## 6. Scoring Logic

### 6.1 Add Point

When the user taps **Add Point** for a team:

1. Increment the game score according to padel rules
2. Update UI immediately
3. Persist the new state

### 6.2 Remove Point (Undo)

When the user taps **Remove Point** for a team:

1. Decrement the game score following reverse padel rules
2. Prevent score from going below `0`
3. If undoing a completed game, restore previous game state
4. Update UI immediately
5. Persist the new state

### 6.3 Game Win

When a team wins a game:

- Increment that team’s **set games count**
- Reset both teams’ **game points to 0**

### 6.4 Set Win

When a team wins a set:

- Increment set counter (if tracked visually)
- Reset game counters
- Continue match unless user starts a new game manually

---

## 7. State Management & Persistence

### 7.1 Persisted Data

The following must be stored locally on the device:

- Team A game points
- Team B game points
- Team A games in current set
- Team B games in current set
- Match status (active / finished)
- Timestamp of last update

### 7.2 Persistence Rules

State must be saved:
- On every score change
- When navigating away from Game Screen
- When the app is backgrounded (via `onDestroy` lifecycle callback)

> **Note:** Uses Zepp OS v1.0 lifecycle - see [PRD-Review.md](./PRD-Review.md) Section 1, Decision 4 for lifecycle semantics.

State must be restored:
- On app reopen (via `onInit` lifecycle callback)
- On "Resume Game"

> **Note:** Pages are destroyed and recreated on each navigation in Zepp OS v1.0.

---

## 8. Navigation Flow

### 8.1 Flow Diagram (Textual)

- App Launch
  → Home Screen
    → Start New Game
      → Game Screen
    → Resume Game
      → Game Screen

- Game Screen
  → Home Button
    → Home Screen (state saved)

---

## 9. Error Handling & Edge Cases

### 9.1 Invalid Actions

- Removing points when score is already at minimum → no-op
- Multiple rapid taps → debounce to avoid double scoring

### 9.2 App Interruptions

- Incoming notifications
- Screen lock
- App backgrounding

Expected behavior:

- No data loss
- Resume exactly where the user left off

---

## 10. Performance Requirements

- UI updates must occur within **100ms**
- No visible lag when tapping buttons
- Minimal memory footprint

---

## 11. Accessibility & Usability

- Large touch targets suitable for sports usage
- High contrast for outdoor visibility
- Minimal text, icon-first interaction

---

## 12. Non-Goals (Out of Scope – v1)

- Player names
- ~~Match history~~ (removed - **now in scope**, see PRD-Review.md Section 1, Decision 1)
- Tie-break configuration
- Cloud sync
- Companion phone app integration

> **Note:** Match history is now in scope for v1.0. See [PRD-Review.md](./PRD-Review.md) for details.

---

## 13. Future Enhancements

- Tie-break configuration options (e.g., super tie-break)
- ~~Match history~~ (now implemented in v1.0)
- Haptic feedback on score change
- Voice input (if supported by Zepp OS)
- Companion mobile app

---

## 14. Open Questions

- Maximum number of sets per match
- Whether to support doubles player names

### 14.1 Resolved Clarifications

- v1 scoring rules are fixed to traditional padel/tennis scoring (deuce/advantage + tie-break at `6-6`).
- Engineering implementation approach for scoring logic is **Option 2**: state machine with transition history for deterministic undo.

---

## 15. Acceptance Criteria

- User can start a new game
- User can resume a previous game
- User can add/remove points for either team
- User can view current game and set scores
- Game state persists across app restarts

---

**End of PRD**
