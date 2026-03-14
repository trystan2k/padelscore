## Goal
Implement Task 77 to rebuild multi-family screen adaptation for `w390-s`, `w454-r`, `w466-r`, and `w480-r`.

## Instructions
- Preserve the existing UI on square devices as much as possible.
- Keep scope focused on adaptation, not redesign.
- Stay Zepp OS compatible and avoid unnecessary runtime branching.

## Discoveries
- Existing page layouts already flow through `getScreenMetrics()` and `resolveLayout()`, so the safest implementation seam was the shared metrics layer.
- Asset selection is already handled by the `assets/gt.*` family folders plus `app.json` screen-family targets; runtime filename switching was unnecessary.
- The square status-bar reservation can be applied broadly without page-specific rewrites because the layout engine already honors `metrics.safeTop`.

## Accomplished
- Replaced legacy GTS-3-specific screen detection with explicit family-first screen metrics and a `getStatusBarHeight()` helper.
- Added family token overlay plumbing in `utils/design-tokens.js` while keeping shared token ratios unchanged.
- Expanded automated coverage for family detection, square safe-top behavior, home/game/summary layout smoke checks, and asset-folder parity.
- Ran focused Biome checks and the full `npm test` suite successfully.

## Next Steps
- Validate in simulator or on-device for `w390-s`, `w454-r`, `w466-r`, and `w480-r` if visual confirmation is needed beyond automated tests.
- If a larger round family needs visual tuning later, add narrow per-family token overrides through `getFamilyTokens()`.

## Relevant Files
- `utils/screen-utils.js` — family-first metrics, status-bar policy, safe-top resolution
- `utils/design-tokens.js` — family token overlay hook for future minimal per-family scaling
- `tests/screen-utils-consolidation.test.js` — family detection and status-bar policy coverage
- `tests/home-screen.test.js` — home layout smoke checks across supported families
- `tests/game-screen-layout.test.js` — game layout and scoring smoke checks across supported families
- `tests/summary-screen.test.js` — square safe-top summary smoke check
- `tests/asset-family-support.test.js` — manifest/asset family parity checks