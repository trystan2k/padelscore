## Task Analysis
- Main objective: Produce an executable, ordered backlog that applies the confirmed product decisions and resolves audited architecture/documentation gaps without expanding scope.
- Identified dependencies: Runtime and persistence flow spans `page/game.js`, `page/index.js`, `page/setup.js`, `page/summary.js`, `app.js`, `utils/storage.js`, `utils/match-storage.js`, `utils/match-state.js`, `utils/match-state-schema.js`, `utils/start-new-match-flow.js`, `utils/app-data-clear.js`, and release/docs files (`.github/workflows/*.yml`, `.releaserc.json`, `README.md`, `RELEASE.md`, `CHANGELOG.md`, `CONTEXT.md`, scoped PRD docs).
- System impact: High cross-cutting impact across state lifecycle, storage compatibility, resume/start flows, CI/release automation, and product documentation consistency (including Zepp OS v1 lifecycle semantics).

## Chosen Approach
- Proposed solution: Use an adapter-first incremental unification plan (single canonical persisted schema + single storage abstraction), then remove globalData handoff fallbacks and dual-write behavior, then align release/docs. Keep match history in scope and preserve current Summary behavior (no Start New Game button).
- Justification for simplicity: Compared with (A) big-bang rewrite and (B) patch-only fixes, this approach minimizes regression risk while still eliminating root causes; it reuses existing modules and tests, adds migration compatibility first, then removes legacy paths.
- Components to be modified/created: Core runtime/persistence modules (`page/game.js`, `page/index.js`, `page/setup.js`, `app.js`, `utils/*state*`, `utils/*storage*`), CI/release config (`.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.releaserc.json`), and docs (`README.md`, `RELEASE.md`, `CHANGELOG.md`, `CONTEXT.md`, `docs/PRD*.md`, `docs/match-state-integration.md`, `docs/UI-SYSTEM.md`).

## Implementation Steps
1. Establish scope lock, compatibility baseline, and risk guardrails.

### Epic 1 - State + Storage Unification (Required, Highest Priority)

#### Task PAD-53 - Define Canonical Match Session Contract
- Why: Dual runtime/persisted schemas currently require conversion logic in page code and create drift risk.
- Scope (in): Choose canonical shape based on `utils/match-state-schema.js`; define explicit runtime adapter boundary; document fields still needed by scoring runtime.
- Scope (out): Scoring rule changes; UI redesign.
- Dependencies: None.
- Effort: M
- Risk: Medium (schema mismatch can break resume flow).
- Acceptance Criteria:
  - Canonical state contract is documented and agreed.
  - Legacy runtime-only fields are tagged as internal or migrated.
  - No ambiguous ownership between `match-state.js` and `match-state-schema.js`.
- Verification steps:
  - Review contract against `page/game.js` read/write points.
  - Validate compatibility with existing `match-storage` tests.

#### Task PAD-54 - Unify Storage Abstractions Under One Service
- Why: `utils/storage.js` and `utils/match-storage.js` duplicate adapter logic, UTF-8 encoding/decoding, and key management.
- Scope (in): Create/keep one storage service path; keep hmFS fallback behavior; keep migration support for legacy key reads until cutover complete.
- Scope (out): Replacing hmFS backend technology.
- Dependencies: PAD-53.
- Effort: L
- Risk: High (persistence regressions can cause data loss).
- Acceptance Criteria:
  - Single write path for active match session.
  - Single UTF-8 utility path reused by session/history storage.
  - Clear deprecation plan for legacy `padel-buddy.match-state` key.
- Verification steps:
  - Unit tests: save/load/clear, corrupted payload handling, migration from legacy key.
  - Manual: start match, score, exit/reopen, resume exact state.
- Rollback/Mitigation: Keep temporary dual-read (not dual-write) compatibility gate for one release; if failures occur, re-enable legacy read fallback only.

#### Task PAD-55 - Remove Dual Runtime Persistence in Game/Home/Setup/App Flows
- Why: Runtime currently writes/reads both legacy and schema stores and keeps fallback logic spread across pages.
- Scope (in): Refactor `page/game.js`, `page/index.js`, `page/setup.js`, `app.js`, `utils/start-new-match-flow.js`, `utils/app-data-clear.js` to use unified service and one source of truth.
- Scope (out): Feature behavior changes (score logic, navigation intent).
- Dependencies: PAD-54.
- Effort: L
- Risk: High (resume/new-match/reset regressions).
- Acceptance Criteria:
  - No production code path performs dual-write for active match session.
  - Home Resume visibility and restore logic remain correct.
  - Start New Game reset clears exactly one active-session store.
- Verification steps:
  - Integration tests for start/resume/new-match reset.
  - Regression run: `npm run test` and targeted lifecycle tests.
- Rollback/Mitigation: Revert only page integration layer while keeping unified storage implementation intact.

#### Task PAD-56 - Replace Fragile `globalData` Pending Handoffs with Deterministic Session Access
- Why: `pendingPersistedMatchState` and `pendingHomeMatchState` handoffs are brittle and timing-dependent.
- Scope (in): Remove one-shot pending handoff keys from navigation flow; rely on persisted state reads and a bounded in-process cache strategy inside persistence service if needed.
- Scope (out): New navigation patterns.
- Dependencies: PAD-55.
- Effort: M
- Risk: Medium-High (could affect immediate post-navigation resume visibility).
- Acceptance Criteria:
  - No page logic depends on `globalData.pendingPersistedMatchState` or `globalData.pendingHomeMatchState`.
  - Resume button behavior remains stable after back-home transitions.
- Verification steps:
  - Add regression cases for rapid navigate/save/resume transitions.
  - Manual stress test: repeated right-swipe home/back cycles.

#### Task PAD-57 - Fix `matchStartTime` Initialization and History Timestamp Contract
- Why: `page/game.js` checks `this.matchStartTime === null` but does not initialize it in `onInit`, so initialization can be skipped.
- Scope (in): Initialize/track start-time deterministically; align history entry creation with explicit match timing semantics.
- Scope (out): New analytics/timer features.
- Dependencies: PAD-55.
- Effort: S
- Risk: Medium (timestamp correctness and duplicate-history checks).
- Acceptance Criteria:
  - `matchStartTime` is initialized deterministically.
  - History entries use consistent completion/start timing fields.
- Verification steps:
  - Unit test for initialization path.
  - End-to-end manual: complete match, verify history metadata consistency.

#### Task PAD-58 - Add Unification Regression Test Suite
- Why: Architecture changes are high-risk and need explicit coverage.
- Scope (in): Tests for migration, resume robustness, clear/reset behavior, lifecycle persistence under Zepp v1 semantics.
- Scope (out): Snapshot-heavy UI visual tests.
- Dependencies: PAD-53, PAD-54, PAD-55, PAD-56, PAD-57.
- Effort: M
- Risk: Low (test-only).
- Acceptance Criteria:
  - New/updated tests fail on old dual-path behavior and pass on unified behavior.
  - No existing critical flow tests regress.
- Verification steps:
  - Run `npm run test`.
  - Run `npm run complete-check` before merge.

2. Execute medium-priority maintainability/performance backlog after unification stabilizes.

### Epic 2 - Maintainability + Performance Cleanup (Mixed Priority)

#### Task PAD-59 - Consolidate Duplicated Constants and Validation Helpers
- Why: Point mapping and numeric validation logic are duplicated across `page/game.js`, `page/index.js`, and scoring/state modules.
- Scope (in): Centralize shared helpers/constants; update imports.
- Scope (out): Changing gameplay outcomes.
- Dependencies: PAD-55.
- Effort: M
- Risk: Medium (subtle conversion regressions).
- Acceptance Criteria:
  - Single canonical helper set for point conversion and common guards.
  - Removed duplicate local constants where redundant.
- Verification steps:
  - Unit tests for point conversion (regular + tie-break + Ad/Game mapping).
  - Static grep confirms duplicate definitions removed.

#### Task PAD-60 - Remove JSON Stringify Hot-Path Comparisons
- Why: `JSON.stringify` is used repeatedly in score interaction/persistence loops in `page/game.js`, increasing hot-path overhead.
- Scope (in): Replace deep stringify comparisons with cheaper deterministic signature/version strategy and targeted state-diff checks.
- Scope (out): Premature micro-optimization elsewhere.
- Dependencies: PAD-55.
- Effort: M
- Risk: Medium (false positive/negative equality checks).
- Acceptance Criteria:
  - No per-interaction full-state stringify in hot path.
  - Interaction latency budget remains <= 100ms target behavior.
- Verification steps:
  - Performance-focused tests/benchmark harness around scoring interactions.
  - Regression tests for dedupe correctness in persistence queue.

#### Task PAD-61 - Decompose `page/game.js` Mixed Responsibilities
- Why: Current file mixes lifecycle/access control/scoring orchestration/persistence/rendering; this slows safe changes.
- Scope (in): Extract coordinator modules (session access, persistence coordinator, scoring actions, rendering helper boundary) while preserving screen behavior.
- Scope (out): Visual redesign or feature additions.
- Dependencies: PAD-55, PAD-59.
- Effort: L
- Risk: Medium-High (refactor complexity).
- Acceptance Criteria:
  - `page/game.js` reduced to page wiring + orchestration.
  - Extracted modules have focused tests.
- Verification steps:
  - Full test suite + manual gameplay smoke test.
- Rollback/Mitigation: Land in small commits by submodule extraction order (helpers -> persistence -> actions -> render calls).

#### Task PAD-62 - [OPTIONAL NICE-TO-HAVE] Remove Remaining Screen Helper Duplication
- Why: `page/game.js` still defines local `getScreenMetrics()` while importing shared `utils/screen-utils.js`.
- Scope (in): Standardize to shared helper usage and remove local duplicate.
- Scope (out): Reworking layout engine.
- Dependencies: PAD-61.
- Effort: S
- Risk: Low.
- Acceptance Criteria:
  - One metrics helper path used in game page.
- Verification steps:
  - UI smoke on round and square simulators.

3. Align release automation with confirmed branch policy (`main` + `v*`).

### Epic 3 - Release Workflow and Branch Policy Alignment (Required)

#### Task PAD-63 - Expand CI Triggers to `main` and `v*` Branches
- Why: Release pipeline currently gates on CI workflow runs from `main` only.
- Scope (in): Update `.github/workflows/ci.yml` branch filters and keep existing path filters/quality gates.
- Scope (out): New CI jobs.
- Dependencies: None.
- Effort: S
- Risk: Low.
- Acceptance Criteria:
  - CI runs on pushes to `main` and `v*` branches.
- Verification steps:
  - Workflow lint + test push simulation/dry validation.

#### Task PAD-64 - Update Release Workflow + Semantic-Release Branch Gating
- Why: `.github/workflows/release.yml` currently enforces `head_branch == 'main'`; policy now requires `v*` support.
- Scope (in): Update release workflow conditions and `.releaserc.json` branch rules so release automation supports `main` and `v*` without ambiguity.
- Scope (out): Changing versioning strategy beyond branch support.
- Dependencies: PAD-63.
- Effort: M
- Risk: Medium (accidental releases from wrong refs).
- Acceptance Criteria:
  - Release job executes for successful CI runs on `main` and valid `v*` branches.
  - Semantic-release resolves branch/channel correctly for both patterns.
- Verification steps:
  - `npm run release:dry` on representative refs.
  - Workflow condition unit checks (where available) or controlled branch test.
- Rollback/Mitigation: Keep explicit guard clauses preventing non-matching branch execution.

#### Task PAD-65 - Update Release Documentation to Match Actual Behavior
- Why: `RELEASE.md` currently states behavior that diverges from workflow reality.
- Scope (in): Rewrite trigger, branch, and troubleshooting sections to match implemented workflows.
- Scope (out): Broader developer handbook rewrite.
- Dependencies: PAD-63, PAD-64.
- Effort: S
- Risk: Low.
- Acceptance Criteria:
  - `RELEASE.md` aligns 1:1 with workflow files.
- Verification steps:
  - Manual doc-to-config diff review.

4. Align product/docs language with confirmed decisions and Zepp v1 persistence semantics.

### Epic 4 - Documentation and PRD Consistency (Required)

#### Task PAD-66 - Update PRD Scope Decisions and Summary Behavior
- Why: Current PRD docs contain scope drift (history marked out-of-scope in places; summary Start New Game wording still present).
- Scope (in): Update `docs/PRD.md`, `docs/PRD-QA-Remediation-v1.1.md`, `docs/PRD-Finish-Match.md`, `docs/PRD-Refactor-Layout.md`, `docs/match-state-integration.md` to reflect:
  - match history is in scope,
  - summary does not require Start New Game,
  - persistence/lifecycle wording is Zepp v1-compatible.
- Scope (out): New product requirements beyond confirmed decisions.
- Dependencies: None.
- Effort: M
- Risk: Low.
- Acceptance Criteria:
  - No conflicting statements across scoped PRD docs.
  - No v2+ lifecycle terms used as implementation requirements for v1 pages.
- Verification steps:
  - Grep audit for conflicting phrases (`onShow`, `onHide`, summary start-new-game action text).

#### Task PAD-67 - Refresh README and CONTEXT for Current Architecture
- Why: README is stale (naming/paths/feature statements), and CONTEXT API list is incomplete.
- Scope (in): Correct setup/project structure, persistence architecture, and Zepp v1 API coverage in `README.md` and `CONTEXT.md`.
- Scope (out): Marketing rewrite.
- Dependencies: PAD-66.
- Effort: S
- Risk: Low.
- Acceptance Criteria:
  - README commands/paths and feature descriptions match current repo.
  - CONTEXT includes currently used v1 APIs and lifecycle constraints.
- Verification steps:
  - Manual command/path validity check.
  - Cross-check API names against runtime usage.

#### Task PAD-68 - Repair CHANGELOG Duplicate `1.0.0` Blocks
- Why: `CHANGELOG.md` has duplicate/competing `1.0.0` sections and formatting inconsistency.
- Scope (in): Normalize to one coherent historical baseline without losing release history.
- Scope (out): Rewriting generated semantic-release sections.
- Dependencies: PAD-65.
- Effort: S
- Risk: Low-Medium (history integrity concerns).
- Acceptance Criteria:
  - Single authoritative `1.0.0` section.
  - File remains compatible with semantic-release append behavior.
- Verification steps:
  - Manual integrity review + next `release:dry` preview.

#### Task PAD-69 - [OPTIONAL NICE-TO-HAVE] Create `docs/UI-SYSTEM.md`
- Why: Layout/token/component system exists but lacks a maintained reference doc.
- Scope (in): Add concise architecture + usage documentation for `design-tokens`, `screen-utils`, `layout-engine`, `layout-presets`, `ui-components`.
- Scope (out): New UI system functionality.
- Dependencies: PAD-67.
- Effort: S
- Risk: Low.
- Acceptance Criteria:
  - `docs/UI-SYSTEM.md` exists and reflects current utility APIs.
- Verification steps:
  - Spot-check doc examples against current utility exports.

5. Recommended PR sequence and branch strategy (AGENTS.md compliant).

### Recommended PR Sequence
1. PR-1: `feature/PAD-53-canonical-state-and-storage-contract`
   - Includes: PAD-53, PAD-54
   - Goal: lock schema + single storage architecture with compatibility read path.
2. PR-2: `feature/PAD-55-runtime-unification-and-handoff-removal`
   - Includes: PAD-55, PAD-56, PAD-57
   - Goal: remove dual runtime persistence and fragile globalData pending handoffs.
3. PR-3: `feature/PAD-58-unification-regression-tests`
   - Includes: PAD-58
   - Goal: harden lifecycle/resume/reset correctness.
4. PR-4: `feature/PAD-63-release-v-branch-support`
   - Includes: PAD-63, PAD-64, PAD-65
   - Goal: release automation parity for `main` + `v*`.
5. PR-5: `feature/PAD-66-prd-and-doc-consistency`
   - Includes: PAD-66, PAD-67, PAD-68
   - Goal: scope/lifecycle/doc consistency.
6. PR-6 (optional): `feature/PAD-61-game-page-maintainability`
   - Includes: PAD-59, PAD-60, PAD-61, PAD-62 (optional), PAD-69 (optional)
   - Goal: medium-priority maintainability/performance cleanup.

### Branch Strategy Notes
- Keep one primary task ID per branch (`feature/PAD-[id]-[title]`).
- Keep high-risk architecture changes isolated from documentation-only PRs.
- Merge order should preserve runtime safety first (Epic 1), then automation/docs.

6. Do-not-do list to prevent scope creep.

### Do Not Do
- Do not remove or de-scope match history (explicitly in scope).
- Do not add a Summary “Start New Game” action unless product decision changes.
- Do not introduce Zepp OS v2+ lifecycle hooks (`onShow/onHide/onResume/onPause`) into v1 page contracts.
- Do not redesign scoring rules, tie-break rules, or add new gameplay features during unification.
- Do not add cloud sync, account features, or companion-phone coupling.
- Do not run a big-bang rewrite that removes compatibility migration in the same step.

## Validation
- Success criteria:
  - One canonical active-session schema and one active-session storage abstraction are used in production paths.
  - Resume/new-match/clear-app-data flows are deterministic without `globalData` pending handoff keys.
  - Release automation supports both `main` and `v*` branches.
  - Scoped PRD/docs are internally consistent with confirmed product decisions and Zepp v1 semantics.
  - Test and quality gates pass (`npm run test`, `npm run complete-check`) before merge of required epics.
- Checkpoints:
  - Pre-implementation assumptions check: confirm canonical schema owner, legacy compatibility window, and branch naming IDs.
  - During-implementation correctness checks: per-PR regression tests for start/resume/finish/history and release dry-run validation for branch gating.
  - Post-implementation verification: manual lifecycle matrix (launch, resume, back-home, app exit/reopen), release workflow smoke on `main` and `v*`, and docs consistency grep audit.
