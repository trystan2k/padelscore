## Goal
Implement Task 74 by migrating `app.json` to a Zepp OS v3 screen-family manifest while preserving the Task 73 app identity/version baseline.

## Instructions
- Treat Zepp OS v3 migration docs/PRD as source of truth over older repo v1 docs.
- Keep Task 74 scoped to manifest migration unless extra changes are required for manifest correctness.
- Preserve appId `1108585`, version `3.0.0`, removed app-side/setting modules, and the eight existing page registrations.

## Discoveries
- Official Zepp OS v3 sample manifests use `targets.<key>.platforms[].dw` for design width in the working schema.
- Existing codebase storage uses `hmFS` file I/O, not `@zos/storage` `LocalStorage`, so `device:os.local_storage` was unnecessary for the current implementation.
- Zeus build required new qualifier-based asset directories once `st`/`sr` target qualifiers were introduced.

## Accomplished
- Migrated `app.json` to `configVersion: "v3"` with runtime API version `3.6` and preserved Task 73 identity/version values.
- Replaced `deviceSource` targeting with explicit `w390-s`, `w454-r`, `w466-r`, and `w480-r` qualifiers plus per-platform `dw` values.
- Removed the obsolete storage permission and kept the eight page entries intact for both target namespaces.
- Added qualifier-based asset directories needed for Zeus build compatibility and updated the approved plan with the concrete schema notes discovered during implementation.
- Validated the manifest with a Node structure check and `npm run build:all`.

## Next Steps
- QA should review the icon size warning for `w480-r` and decide whether higher-resolution round assets are needed.
- A later migration task can normalize legacy-looking target key names and asset namespaces after broader Zepp v3 asset/layout work lands.

## Relevant Files
- `app.json` — Zepp OS v3 manifest with screen-family targeting and cleaned permissions.
- `docs/plan/Plan 74 Migrate app.json to v3 Screen-Family Targets.md` — plan updated with concrete v3 schema notes.
- `assets/gtr-3.w454-r` — round-family asset copy for 454-wide devices.
- `assets/gtr-3.w466-r` — round-family asset copy for 466-wide devices.
- `assets/gtr-3.w480-r` — round-family asset copy for 480-wide devices.
- `assets/gts-3.w390-s` — square-family asset copy for 390-wide devices.