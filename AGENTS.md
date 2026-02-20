# AGENTS.md – Coding Agent Guide for padelscore

## Project context

We are developing a **padel score app** for **Amazfit watches** running **Zepp OS** (v1.0+).
The app will allow users to track the score of a padel match directly from their wrist.

Key references:

- **Official Documentation**: [Zepp OS Developers Documentation](https://docs.zepp.com/docs/intro/)
- **Zepp App Tooling**: [Zepp App Developer Mode](https://docs.zepp.com/docs/guides/tools/zepp-app/)

## QA Gate Commands

At the moment this project does not have a QA gate script to be executed, so if someone needs to run qa checks, just say it to report all ok.

## Feature branch naming

- **Format**: `feature/PAD-[ID]-[title]`
  - `ID`: Task ID obtained from task master.
  - `title`: Descriptive name of the feature, obtained from task master
- **Examples**:
  - `feature/PAD-001-user-auth`: User authentication flow.
  - `feature/PAD-002-score-tracking`: Padel score tracking functionality.

## Commit Messages

- **Format**: `[type]: [description]`
  - `type`: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
  - `description`: Brief description of the change.
  - `task IDs`: Do not include task IDs/task numbers (for example, `PAD-001`) in commit messages unless explicitly requested.
- **Examples**:
  - `feat: add user authentication`
  - `fix: resolve memory leak in score calculation`
  - `docs: update installation guide`

## Code Style Guidelines

- **Indentation**: 2 spaces (see .editorconfig)
- **Line endings**: LF, final newline, trim trailing whitespace
- **Naming Conventions**:
  - Files: `snake_case` or `kebab-case` generally preferred in Zepp OS projects (though some templates use `camelCase`). Follow existing project structure.
  - Variables/Functions: `camelCase`.
- **Responsive Units Baseline**:
  - Keep target-specific `designWidth` values in `app.json` (`454` for `454x454-amazfit-gtr-3`, `390` for `390x450-amazfit-gts-3`).
  - Use responsive units for layout values (`rpx` preferred). Use `px` only when fixed physical sizing is required (for example, 1px dividers or bitmap-native asset dimensions).

## Stack used

### Runtime & Framework

- **Platform**: Zepp OS (Amazfit devices like GTR 3, T-Rex 2, Balance, etc.)
- **Framework**: Zepp OS Mini Program Framework ("Lightweight" JS framework).
- **Language**: JavaScript (ES6+) / TypeScript (if configured).
- **UI System**: Zepp OS UI Widgets (Canvas-based rendering, not standard DOM).
  - Uses `createWidget` API for UI elements.
  - Layouts are often absolute or relative to screen dimensions.

### Development Tools

- **CLI Tool**: **Zeus CLI** (`@zeppos/zeus-cli`)
  - `zeus create`: Scaffold new projects.
  - `zeus dev`: Run in simulator with hot reload.
  - `zeus preview`: Generate QR code for real device testing.
  - `zeus build`: Package app (`.zab`) for distribution.
- **Simulator**: Zepp OS Simulator (for local testing).
- **Companion App**: **Zepp App** (Mobile)
  - Must enable **Developer Mode** (Profile -> Settings -> About -> Tap Icon 7 times).
  - Used to scan QR codes from `zeus preview` to install apps on the watch.
  - Provides access to **Real Device Logs**.

### Project Structure (Typical)

- `app.js` / `app.json`: Global application logic and configuration.
- `pages/`: Contains the UI screens of the watch app.
- `app-side/`: (Optional) Side service running on the phone (in Zepp App) for internet access/heavy logic.
- `setting/`: (Optional) Settings page rendered within the Zepp App on the phone.
- `assets/`: Images and resources.
