# Zepp OS / Amazfit Padel Buddy App - Get Started

This guide summarizes what you need to start building an Amazfit smartwatch app to track padel scores.

## What You Need

- A Zepp/Open Platform account (for CLI login, app registration, publishing): <https://console.zepp.com>
- Node.js 24.x (Zepp Quick Start guide also uses Node.js examples): <https://docs.zepp.com/docs/guides/quick-start/environment/>
- Zeus CLI installed globally:

```bash
npm i -g @zeppos/zeus-cli
```

- Zepp OS Simulator, with at least one device model downloaded: <https://docs.zepp.com/docs/guides/tools/simulator/>
- Zepp mobile app and an Amazfit watch (optional for first simulator-only steps, required for real-device testing): <https://docs.zepp.com/docs/guides/tools/zepp-app/>

## First-Time Setup Flow

Create a new project:

```bash
zeus create padel-buddy
```

Run and iterate in simulator:

```bash
zeus dev
```

Login to your Zepp account from CLI:

```bash
zeus login
```

Generate a QR code and install on watch via Zepp app Developer Mode:

```bash
zeus preview
```

Build a distributable package:

```bash
zeus build
```

## Recommended MVP for a Padel Buddy App

Start with a Device App only (watch UI), and keep scope small:

- Team A score
- Team B score
- Current game/set view
- Undo last point

Then expand later with:

- Settings App (configuration in mobile app)
- Side Service (cloud sync/history)

## Zepp-Specific Concepts to Know

- `app.json` is the core configuration file (appId, version, targets, permissions, i18n): <https://docs.zepp.com/docs/reference/app-json/>
- Enable Zepp app Developer Mode (Profile -> Settings -> About -> tap Zepp icon 7 times)
- Device compatibility depends on model/API_LEVEL: <https://docs.zepp.com/docs/reference/related-resources/device-list/>
- Before publishing, register your app in console and use that `appId` in `app.json`: <https://docs.zepp.com/docs/distribute/>

## Useful Official Entry Points

- Zepp OS docs intro: <https://docs.zepp.com/docs/intro/>
- Quick Start: <https://docs.zepp.com/docs/guides/quick-start/>
- Zeus CLI: <https://docs.zepp.com/docs/guides/tools/cli/>
- Simulator: <https://docs.zepp.com/docs/guides/tools/simulator/>
- Samples: <https://docs.zepp.com/docs/samples/>

## Testing

Run all tests:

```bash
npm test
```

### Unification Regression Suite

The unification regression suite validates the persistence unification work (Tasks 53-58) covering:

- **Schema validation**: Canonical schema structure, field validation, serialization round-trips
- **Storage CRUD**: getActiveSession/saveActiveSession/clearActiveSession operations
- **Migration**: Legacy session migration precedence, idempotency, cleanup
- **Runtime consistency**: Save/load/update cycles, timing field preservation, restart persistence

Run the unification suite specifically:

```bash
npm run test:unification
```

#### Interpreting Test Failures

- **Unit test failures** (`*.test.js`): Typically indicate schema validation, serialization, or single-function behavior issues
- **Integration test failures** (`*.integration.test.js`): Typically indicate migration, storage, or cross-module interaction issues
