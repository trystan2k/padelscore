## Goal
Refine Task 74 from split v3 targets to a single generic v3 target in `app.json` while keeping the task scoped to manifest and asset wiring only.

## Instructions
- Keep Task 74 scoped to manifest migration only.
- Preserve Task 73 baseline: appId `1108585`, version `3.0.0`, no app-side/setting modules.
- Prefer the cleanest v3-native structure Zeus accepts.

## Discoveries
- Official Zepp v3 samples support the desired single generic target shape (`gt`).
- Zeus build accepts one target with four explicit `sr`/`st` families and per-platform `dw` values.
- For explicit family qualifiers, Zeus still needs matching qualifier-based asset directories rather than a shared generic round/square asset folder.

## Accomplished
- Collapsed `app.json` to one `gt` target with `w390-s`, `w454-r`, `w466-r`, and `w480-r` under `targets.gt.platforms`.
- Preserved the exact 8 page registrations, app identity, and runtime baseline.
- Renamed the qualifier asset directories from the earlier split-target approach to `gt.*` and removed obsolete `gtr-3` / `gts-3` asset namespaces.
- Updated the approved plan file with the concrete single-target implementation choice.
- Revalidated with a manifest structure check and `npm run build:all`.

## Next Steps
- QA should verify packaging on all four families and review the existing `w480-r` icon size warning.
- No additional runtime/page migration is required for Task 74 itself.

## Relevant Files
- `app.json` — single-target v3 manifest.
- `docs/plan/Plan 74 Migrate app.json to v3 Screen-Family Targets.md` — refined implementation note.
- `assets/gt.w390-s` — square-family assets for the single target.
- `assets/gt.w454-r` — round-family assets for 454-wide devices.
- `assets/gt.w466-r` — round-family assets for 466-wide devices.
- `assets/gt.w480-r` — round-family assets for 480-wide devices.