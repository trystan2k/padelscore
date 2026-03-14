## What
Created an implementation-ready deepthink plan for Task 77 to rebuild screen adaptation for `w390-s`, `w454-r`, `w466-r`, and `w480-r`.

## Why
The user requested a planning-only execution plan that stays simple, preserves the existing UI on square devices, and focuses strictly on adaptation rather than redesign.

## Where
- `docs/plan/Plan 77 Rebuild Screen Adaptation for Multi-Family Support.md`
- Analysis inputs: `utils/screen-utils.js`, `utils/design-tokens.js`, `utils/layout-engine.js`, `utils/layout-presets.js`, `utils/ui-components.js`, all page layout modules, `app.json`, family asset folders, and the existing screen/layout tests.

## Learned
- Current adaptation is still anchored to GTS 3-specific square detection in `utils/screen-utils.js` and corresponding tests.
- The existing architecture already centralizes most layout behavior through `getScreenMetrics()`, `resolveLayout()`, and shared presets, so the simplest path is to extend those shared seams rather than branch page layouts per family.
- The current v3 asset structure already uses family directories (`assets/gt.w390-s`, `assets/gt.w454-r`, `assets/gt.w466-r`, `assets/gt.w480-r`), so runtime asset switching should only be added if audit proves manifest-based resolution is insufficient.