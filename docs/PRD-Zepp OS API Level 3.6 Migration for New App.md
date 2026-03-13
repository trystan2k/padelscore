# PRD-Zepp OS API Level 3.6 Migration for New App

**Version:** 1.0 | **Updated:** 2026-03-13

---

## Context

Padel Buddy currently targets Zepp OS `1.0` devices with a `v2` `app.json` manifest and device-specific targets for `GTR 3` and `GTS 3`.

The approved direction is to:
- fully replace the mainline app with a Zepp OS `3+` implementation
- publish it as a new app with a new `appId`
- preserve the current Zepp OS `1.0` app separately on a manually created `v1` maintenance branch
- keep the same end-user functionality
- target a minimum supported `API_LEVEL` of `3.6`

This plan is implementation-ready and intended to serve as the source plan for Task Master task creation.

---

## Approved Scope

### In Scope
- Migrate the app manifest from Zepp OS `1.0` / `app.json v2` to Zepp OS `3+` / `app.json v3`
- Publish the migrated app under a new `appId`
- Target modern Zepp OS devices with minimum `API_LEVEL 3.6`
- Preserve all current end-user functionality:
  - start new match
  - resume active match
  - add point
  - undo point
  - set/match progression
  - manual match finish
  - match summary
  - match history list/detail/delete
  - app settings
  - vibration feedback toggle
  - persistence across exits/navigation
- Simplify implementation where Zepp OS `3+` APIs provide safer or cleaner approaches
- Rework layout adaptation for supported modern screen families
- Maintain and extend regression safety through tests and manual verification

### Out of Scope
- Supporting Zepp OS `1.0` in the mainline app
- Maintaining dual-runtime compatibility inside one package
- Backend, server sync, or cloud storage
- Product redesign beyond adaptation and migration necessities
- Task for manually creating the `v1` branch

---

## Locked Decisions

### Product / Release
- The migrated app is a **new product identity** with a **new `appId`**.
- The current Zepp OS `1.0` line remains external to this migration plan.
- Mainline support begins at **`API_LEVEL 3.6`**.

### Technical
- `app.json` will move to **`configVersion: "v3"`**.
- The new app will support modern **round** and **square** watches only.
- The target matrix will be based on **screen families**, not legacy device names.
- The migration will use an **adapter-led strategy** instead of a direct in-place port.
- Storage will be **`LocalStorage`-first**.
- The current layout engine may be reused initially if it can be adapted safely.

---

## Supported Device Strategy

Minimum supported runtime: **`API_LEVEL 3.6`**

### Supported Screen Families
- `w390-s` square
- `w454-r` round
- `w466-r` round
- `w480-r` round

### Why This Range
This support policy keeps the matrix focused on relevant modern watches while avoiding older `3.0` / `3.5` edge cases such as `w320` square devices.

### Examples of Covered Device Classes
- `390x450` square devices such as modern square watches in the Active/GTS class
- `454x454` round devices such as Cheetah Round / T-Rex Ultra class
- `466x466` round devices such as GTR 4 / Active 2 round class
- `480x480` round devices such as T-Rex 3 / Balance / Cheetah Pro class

---

## Codebase Analysis Summary

### Low-Risk Reusable Areas
These areas are primarily business/domain logic and should be preserved where possible:
- `utils/scoring-engine.js`
- `utils/history-stack.js`
- `utils/match-state-schema.js`
- validation and normalization helpers
- large parts of the current Node test suite

### High-Risk Migration Hotspots
These areas are tightly coupled to Zepp OS `1.0` runtime APIs or legacy assumptions:
- `app.json`
- `app.js`
- `page/index.js`
- `page/setup.js`
- `page/game.js`
- `page/summary.js`
- `page/history.js`
- `page/history-detail.js`
- `page/settings.js`
- `page/game-settings.js`
- `utils/screen-utils.js`
- `utils/storage.js`
- `utils/active-session-storage.js`
- `utils/match-history-storage.js`
- `utils/ui-components.js`

### Important Existing Findings
- `app-side/index.js` and `setting/index.js` are effectively empty stubs and may be removed from the new app unless later needed.
- `utils/screen-utils.js` currently contains `GTS 3`-specific square-safe-top logic that is not suitable for the modern screen-family model.
- Legacy storage layers duplicate UTF-8 and filesystem compatibility code because of Zepp OS `1.0` limitations.
- Current code uses `setTimeout` / `clearTimeout` in multiple flows; Zepp OS `3+` docs say standard JS timers are unsupported, so timer-dependent UX should be redesigned or eliminated.

---

## Zepp OS 3+ Migration Opportunities

### Manifest and Targeting
Use `app.json v3` with `targets.platforms` screen qualifiers:
- `st` for screen type (`r`, `s`)
- `sr` for width families such as `w390`, `w454`, `w466`, `w480`

### Platform APIs to Prefer
- `@zos/storage` -> `LocalStorage`
- `@zos/router` -> `push`, `back`, `home`
- `@zos/interaction` -> `onGesture`, `offGesture`, `showToast`
- `@zos/device` -> `getDeviceInfo()` and `screenShape`
- `@zos/display` -> `setPageBrightTime`, `resetPageBrightTime`, `pauseDropWristScreenOff`, `resetDropWristScreenOff`
- `@zos/ui` square-screen status bar controls if needed

### Resource and Screen Adaptation Model
Move from legacy device-specific asset folders (`gtr-3`, `gts-3`) to screen-family-based resources aligned with Zepp OS `v3` adaptation guidance.

---

## Non-Functional Requirements

### Performance
- One-tap scoring and undo should remain effectively sub-second.
- Persistence writes must not introduce visible interaction lag.

### Reliability
- Active session must survive navigation and app exit.
- Match history must remain stable and readable.
- Migration should avoid accidental behavior drift in scoring logic.

### UX Safety
- No accidental back/home navigation during scoring.
- Layout must remain readable and touchable across supported devices.
- Square and round layouts must both feel intentional, not merely stretched.

### Maintainability
- New runtime integrations should be centralized behind adapters.
- Avoid preserving Zepp OS `1.0` compatibility code unless it still has value on `3.6+`.

---

## Migration Principles

1. Preserve user-visible behavior first.
2. Simplify implementation only where the replacement is clearly safer or cleaner.
3. Centralize runtime/platform APIs behind internal adapters.
4. Avoid mixing platform migration and deep UX redesign in the same step.
5. Remove timer-dependent behavior rather than depending on undocumented runtime support.
6. Keep regression coverage active throughout the migration.

---

## Detailed Phased Plan

## Phase 1 - Bootstrap New 3.6+ App Identity

### Objective
Establish the new product identity and define the modern app line separately from the legacy app.

### Work
- Add the new `appId`
- Set the new versioning baseline for the modern app line
- Review whether visible `appName` remains identical or needs a store-facing differentiator
- Decide whether `app-side` and `setting` remain in the package or are removed
- Document the new release identity in repo docs

### Deliverables
- Updated app identity strategy
- Clear separation between legacy app and modern app

### Risks
- Confusion between old and new store listings if naming is not documented clearly

---

## Phase 2 - Migrate Manifest to `app.json v3`

### Objective
Make the app buildable and distributable for Zepp OS `3.6+`.

### Work
- Convert `configVersion` from `v2` to `v3`
- Set runtime versions for the new minimum support policy
- Replace legacy device-only targets with screen-family targets:
  - `w390-s`
  - `w454-r`
  - `w466-r`
  - `w480-r`
- Audit permissions for modern APIs
- Confirm page module definitions remain valid in the new manifest
- Remove obsolete legacy targeting data from mainline

### Deliverables
- Valid `app.json v3`
- Explicit target matrix for supported screen families

### Risks
- Incorrect target qualifier setup could misroute layouts/resources at build time

---

## Phase 3 - Introduce Zepp 3.6 Platform Abstraction Layer

### Objective
Decouple page/business code from scattered legacy `hm*` calls and concentrate modern runtime behavior in one place.

### Work
Create internal adapters for:
- router
- gesture handling
- toast messaging
- device info and screen metrics
- display keep-awake control
- storage access
- haptics where practical

### Expected Replacements
- `hmApp.gotoPage` -> router adapter
- `hmApp.goBack` / `gotoHome` -> router adapter
- `hmApp.registerGestureEvent` -> gesture adapter
- `hmUI.showToast` -> toast adapter
- `hmSetting.setBrightScreen` -> display adapter
- direct runtime storage checks -> storage adapter

### Deliverables
- Internal platform adapter modules
- Updated page code consuming adapters instead of raw globals

### Risks
- Test harness must evolve with adapters to prevent brittle mocks

---

## Phase 4 - Migrate Persistence to Modern Storage

### Objective
Preserve active session and history behavior while removing Zepp OS `1.0` storage baggage.

### Work
- Replace most custom UTF-8 / `hmFS` persistence paths with `LocalStorage`
- Keep the persisted match/session schema stable where possible
- Migrate:
  - active session
  - match history
  - haptic/settings state
  - clear-data flow
- Review whether any remaining filesystem use is still justified on `3.6+`
- Remove obsolete runtime migration logic once the modern path is validated

### Deliverables
- `LocalStorage`-first persistence layer
- Preserved resume/history behavior

### Risks
- Data-size constraints and real-device serialization limits must be validated before all filesystem fallbacks are deleted

---

## Phase 5 - Rebuild Screen Adaptation and Resource Strategy

### Objective
Adapt the app cleanly to supported modern square and round devices.

### Work
- Replace `GTS 3`-specific safe-top logic in `utils/screen-utils.js`
- Use `getDeviceInfo()` / `screenShape` plus width-family rules
- Define square-screen status bar policy
  - preferred initial direction: hide it to preserve the current full-screen UX
- Normalize sizing/layout behavior for:
  - `390x450` square
  - `454x454` round
  - `466x466` round
  - `480x480` round
- Reorganize assets from device folders to screen-family-oriented folders
- Update shared UI helpers and any assumptions tied to the old metrics model

### Deliverables
- New screen metrics layer
- Modernized assets/layout adaptation strategy

### Risks
- Overcommitting to a full layout rewrite too early can add unnecessary regression risk

---

## Phase 6 - Port All User Flows Page by Page

### Objective
Migrate the full app experience to Zepp OS `3.6+` while keeping behavior parity.

### Page/Flow Scope
- Home screen
  - start new match
  - resume match
  - settings navigation
  - exit gesture behavior
- Setup screen
  - set-count selection
  - match initialization
  - back navigation
- Game screen
  - scoring
  - undo
  - manual finish
  - autosave
  - haptics
  - keep-awake
  - summary/home transitions
- Summary screen
  - winner text
  - final set score
  - set history
  - home navigation
- History screen
  - match list
  - detail navigation
- History detail screen
  - match detail rendering
  - delete flow
  - back navigation
- Settings screen
  - history entry point
  - game settings entry point
  - clear app data
  - version display
- Game settings screen
  - vibration toggle

### Deliverables
- Full feature parity on the new runtime

### Risks
- `page/game.js` is the highest-risk file because it combines scoring, persistence, gestures, display, navigation, and haptics

---

## Phase 7 - Remove Timer-Dependent UX Assumptions

### Objective
Eliminate dependencies on unsupported standard JS timers in Zepp OS `3+`.

### Current Timer-Dependent Areas
- manual finish confirmation window
- runtime persistence debounce
- delayed navigation after clear-data toast
- summary multi-pulse haptic timing
- delete confirmation reset timing

### Recommended Direction
Prefer redesign over undocumented timer reliance:
- synchronous save instead of debounced persistence
- simpler confirm flows without countdown windows where possible
- immediate navigation after action completion
- single haptic pulse instead of timed pulse sequences

### Deliverables
- Runtime-safe interaction model for Zepp OS `3.6+`

### Risks
- Some UX flows may need behavior changes internally even if user-facing outcomes remain effectively the same

---

## Phase 8 - QA Hardening and Release Readiness

### Objective
Make the migrated app releasable and maintainable.

### Work
- Update tests to mock the adapter layer rather than raw `hm*` globals
- Preserve current regression coverage for scoring and persistence behavior
- Add migration-focused tests where needed
- Run full repo QA gate
- Validate on representative simulator/device matrix
- Update documentation for the new app line

### Required Verification Matrix
- one `390-square` device
- one `454-round` device
- one `466-round` device
- one `480-round` device
- `T-Rex 3` should be included if possible because it is a primary target motivation

### Deliverables
- Passing QA
- Release-ready documentation
- Validated supported-device matrix

---

## Risks and Mitigations

### Risk 1 - Timer support mismatch
- **Risk:** Current code assumes `setTimeout` / `clearTimeout` support.
- **Mitigation:** Remove timer-dependent patterns during migration.

### Risk 2 - Layout regressions across modern screens
- **Risk:** The current metrics model is too tied to legacy devices.
- **Mitigation:** Rebuild adaptation around screen shape + width families, then verify across the selected matrix.

### Risk 3 - Persistence behavior drift
- **Risk:** Replacing legacy storage can accidentally alter resume/history semantics.
- **Mitigation:** Keep schema behavior stable and verify through existing storage/session/history tests.

### Risk 4 - Over-scoping the migration
- **Risk:** Rewriting too much at once increases schedule and regression risk.
- **Mitigation:** Use adapters, parity-first page migration, and phased cleanup.

### Risk 5 - App identity confusion
- **Risk:** Users may confuse the new app with the legacy app.
- **Mitigation:** Document the new app line clearly in release docs and metadata.

---

## Testing Strategy

### Automated
- Preserve and adapt the existing Node-based test suite
- Focus especially on:
  - scoring engine
  - history stack
  - active session persistence
  - history persistence
  - page interaction flows
  - screen/layout calculations
- Run full quality gate via `npm run complete-check`

### Manual / Device
- Validate all critical flows on representative square and round hardware
- Check touch target usability, text fit, haptics, gestures, and save/resume reliability
- Verify keep-awake behavior specifically during active matches

---

## Task Master Conversion Rules

When creating Task Master tasks from this plan:
- append new tasks to the **existing** Task Master project
- do **not** remove or overwrite any existing tasks
- create the tasks under the **current tag** already in use by the repository
- exclude the manual `v1` branch-creation step from Task Master
- preserve dependency ordering between the migration tasks

---

## Approved Task Set for Task Master

The approved Task Master task set is:

1. Bootstrap new `3.6+` app identity
2. Migrate `app.json` to `v3` screen-family targets
3. Introduce Zepp `3.6` platform adapters
4. Migrate persistence to modern storage
5. Rebuild screen adaptation and shared UI foundations
6. Port all page flows and remove timer assumptions
7. Final QA, device matrix validation, and release readiness

These tasks should be added to the existing Task Master backlog under the current tag after this plan file is stored.

---

## Success Criteria

The migration is successful when:
- the app builds and runs as a Zepp OS `3.6+` app with a new `appId`
- all current end-user functionality remains available
- supported modern square and round devices are validated
- timer-dependent legacy assumptions are removed or replaced safely
- the test suite and final QA gate pass
- the plan has been converted into appended Task Master tasks under the current tag
