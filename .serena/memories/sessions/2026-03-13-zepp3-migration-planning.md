## Goal
Prepare a deep analysis and migration plan to move Padel Buddy from Zepp OS v1.0 to Zepp OS API Level 3+.

## Instructions
- Full replacement, not dual support.
- Move current Zepp OS 1.0 code to a `v1` maintenance branch.
- Preserve end-user functionality.
- Use a new appId for the migrated app.
- Target minimum supported API_LEVEL `3.6`.

## Discoveries
- Current `app.json` is still `configVersion: v2` with Zepp OS 1.0 runtime versions.
- Main migration hotspots are manifest/runtime config, storage helpers, screen adaptation, navigation, gestures, and display keep-awake logic.
- `app-side/index.js` and `setting/index.js` are empty stubs and may be removable in the new app line.
- Zepp OS v3+ docs provide strong replacements for current legacy APIs: `@zos/router`, `@zos/interaction`, `@zos/storage`, `@zos/device`, and `@zos/display`.
- Current code relies on `setTimeout`/`clearTimeout`, but Zepp OS v3+ docs say standard timers are unsupported; the migration plan should remove or redesign timer-dependent UX instead of relying on undocumented behavior.
- Choosing minVersion `3.6` keeps the support matrix focused on `w390` square and `w454`/`w466`/`w480` round devices, including T-Rex 3-class hardware.

## Accomplished
- Researched Zepp OS v3+ `app.json`, API_LEVEL compatibility, screen adaptation, routing, interaction, storage, display, and device APIs.
- Analyzed the current repository structure and identified file-level migration hotspots.
- Collected user decisions: full replacement, new appId, minVersion `3.6`.
- Prepared an approval-ready phased migration plan and Task Master task proposal.

## Next Steps
- Present the final structured migration plan to the user.
- If approved, create Task Master tasks from the plan.
- During implementation, start with branching/baseline freeze and manifest/target redesign.

## Relevant Files
- `app.json` — current Zepp OS 1.0 manifest and device targets
- `app.js` — app lifecycle and emergency persistence
- `page/game.js` — scoring flow, gestures, keep-awake, persistence debounce
- `page/index.js` — home flow and gesture exit behavior
- `utils/screen-utils.js` — current device-shape detection and GTS 3 square assumptions
- `utils/storage.js` — legacy runtime key-value persistence and UTF-8 helpers
- `utils/active-session-storage.js` — canonical active-session persistence and migration logic
- `utils/match-history-storage.js` — match history persistence via hmFS