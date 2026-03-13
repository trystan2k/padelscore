# Padel Buddy – Project Overview

## Purpose
A padel match score tracker app for Amazfit watches running Zepp OS v1.0.

## Tech Stack
- Platform: Zepp OS (Amazfit GTR 3, GTS 3, T-Rex 2, etc.)
- Framework: Zepp OS Mini Program Framework
- Language: JavaScript (ES6+)
- UI: Zepp OS Widget API (canvas-based, no DOM)
- CLI: Zeus CLI (@zeppos/zeus-cli)
- Node.js + npm

## Project Structure
- `app.js` / `app.json` – global app logic and config
- `page/` – UI pages: index (home), setup (game config), game (scoring), summary, history
- `utils/` – shared utilities: match-state.js, match-storage.js, storage.js, scoring-engine.js, etc.
- `assets/` – images and resources

## Storage
Two storage layers:
1. **Schema storage** (`utils/match-storage.js`): uses key `ACTIVE_MATCH_SESSION`, backed by `hmFS.SysProSetChars`
2. **Legacy/runtime storage** (`utils/storage.js`): uses key `padel-buddy.match-state`, also backed by `hmFS.SysProSetChars`

Both must be cleared to fully reset a match session.
