## What
Created an implementation-ready deepthink execution plan for Task #73 to bootstrap the new 3.6+ app identity/version baseline and audit/remove `app-side` + `setting` if unused.

## Why
User requested a concrete plan mapped to subtasks 73.1-73.5 with explicit validation checkpoints, failure handling, and file/dependency rationale.

## Where
- docs/plan/Plan 73 Bootstrap new 3.6+ app identity and versioning baseline.md
- Analysis inputs: app.json, app-side/index.js, setting/index.js, .taskmaster/tasks/tasks.json, README.md, RELEASE.md, .github/workflows/release.yml, scripts/sync-version.js.

## Learned
- `app-side/index.js` and `setting/index.js` are currently placeholder stubs and only referenced by `app.json` module entries.
- Version baseline changes in `app.json` should be aligned with `package.json` and `utils/version.js` because `scripts/sync-version.js` enforces coupling during release prep.
- If module directories are removed, release/docs references to `app-side/` and `setting/` should be cleaned for consistency.