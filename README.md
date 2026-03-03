# Padel Buddy

A padel score tracking app for Amazfit watches running Zepp OS. Track match scores directly from your wrist with an intuitive interface designed for padel players.

## Features

- **One-tap scoring** for both teams (Team A and Team B)
- **Undo functionality** to correct scoring mistakes
- **Real-time score display** showing current game points and set scores
- **Match persistence** - resume interrupted games automatically
- **Match summary screen** with scrollable match history
- **Screen keep-awake** during active games to prevent interruptions
- **Traditional padel scoring** including deuce, advantage, and tie-break at 6-6
- **Responsive design** optimized for round (GTR-3) and square (GTS-3) watch faces

## Supported Devices

- Amazfit GTR 3 / GTR 3 Pro (gtr3, gtr3-w)
- Amazfit GTS 3 / GTS 3 Pro (Zurich, ZurichW)

## Screens

1. **Home Screen** - Start new games or resume saved matches
2. **Setup Screen** - Configure match settings before starting
3. **Game Screen** - Main scoring interface with touch controls
4. **Summary Screen** - View match history and final scores

## Getting Started

### Prerequisites

- Node.js 24.x
- Zeus CLI installed globally:
  ```bash
  npm i -g @zeppos/zeus-cli
  ```
- Zepp OS Simulator (for local testing)
- Zepp mobile app with Developer Mode enabled for real-device testing
- A Zepp/Open Platform account: https://console.zepp.com

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd padelscore
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   zeus dev
   ```

### Testing on Device

1. Login to your Zepp account:
   ```bash
   zeus login
   ```

2. Generate a QR code and scan it with the Zepp app:
   ```bash
   zeus preview
   ```

3. Enable Developer Mode in Zepp App:
   - Profile → Settings → About → Tap the Zepp icon 7 times

### Building for Distribution

```bash
zeus build
```

This generates a `.zab` package file ready for distribution.

## Development

### Project Structure

```
padelscore/
├── app.js                 # Application entry point
├── app.json               # App configuration (permissions, targets, i18n)
├── page/                  # Watch UI screens
│   ├── index.js          # Home screen
│   ├── setup.js          # Match setup screen
│   ├── game.js           # Main game screen
│   └── summary.js        # Match summary screen
├── utils/                 # Core business logic
│   ├── scoring-engine.js # Padel scoring logic
│   ├── match-state.js    # State management
│   ├── match-storage.js  # Persistence layer
│   └── history-stack.js  # Undo/redo functionality
├── tests/                 # Test suite
├── assets/                # Icons and resources
└── docs/                  # Documentation and development logs
```

### Running Tests

```bash
npm test
```

### Code Style

- **Indentation**: 2 spaces
- **Line endings**: LF
- **Naming**: camelCase for variables/functions, kebab-case for files
- **Responsive Units**: Use `rpx` for layouts, `px` only for fixed sizing

### Code Quality Tools

This project uses an automated quality gate stack to enforce consistent code style, commit message conventions, and test health before any change reaches the repository.

#### Biome

[Biome](https://biomejs.dev/) is the linter and formatter for all JavaScript and JSON files.

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run lint` | `biome check .` | Check all files for lint errors |
| `npm run lint:fix` | `biome check --write .` | Auto-fix lint and format issues |
| `npm run format` | `biome format --write .` | Format all files (style only) |

Configuration is in [`biome.json`](./biome.json). Key settings:
- Single quotes, no semicolons, 2-space indentation, LF line endings
- Zepp OS globals declared (`hmUI`, `hmApp`, `hmSensor`, etc.) to suppress false-positive "undeclared variable" errors
- `noConsole` disabled — intentional Zepp OS lifecycle logging is allowed

#### Husky

[Husky](https://typicode.github.io/husky/) manages git hooks. Hooks are installed automatically when you run `npm install` (via the `prepare` script).

| Hook | Trigger | Action |
|------|---------|--------|
| `pre-commit` | Before every commit | Runs `lint-staged` on staged files |
| `commit-msg` | After commit message written | Validates message against Conventional Commits |
| `pre-push` | Before every push | Runs `npm test` — blocks push if any test fails |

#### lint-staged

[lint-staged](https://github.com/lint-staged/lint-staged) ensures Biome only runs on the files you staged, keeping pre-commit hooks fast regardless of project size. Configuration is in [`.lintstagedrc.json`](./.lintstagedrc.json).

#### Commitlint

[Commitlint](https://commitlint.js.org/) enforces the [Conventional Commits](https://www.conventionalcommits.org/) specification on every commit message. Configuration is in [`commitlint.config.js`](./commitlint.config.js).

Valid commit message examples:
```
feat: add match history screen
fix: resolve score reset on app resume
docs: update installation guide
chore: upgrade biome to v2
```

## Scoring Rules

The app implements traditional padel/tennis scoring:

- **Game Points**: 0 → 15 → 30 → 40 → Game
- **Deuce/Advantage**: Enabled when both teams reach 40
- **Set Win**: First to 6 games with a 2-game margin
- **Tie-Break**: Played at 6-6 games (first to 7 points, win by 2)
- **Match**: Best of 3 sets (first to 2 sets wins)

## Key Technologies

- **Runtime**: Zepp OS (Amazfit devices)
- **Framework**: Zepp OS Mini Program Framework
- **Language**: JavaScript (ES6+)
- **UI System**: Zepp OS UI Widgets (Canvas-based rendering)
- **Storage**: Local storage via `device:os.local_storage` permission

## Documentation

- [Getting Started Guide](docs/GET_STARTED.md)
- [Product Requirements Document](docs/PRD.md)
- [Development Logs](docs/development-logs/)
- [Zepp OS Official Documentation](https://docs.zepp.com/docs/1.0/intro/)
