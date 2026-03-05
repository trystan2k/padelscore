# PRD-Review

**Version:** 1.1 | **Updated:** 2026-03-05 | **Task:** #67

## 1. Title and Metadata

- PRD name: PRD-Review
- Date: 2026-03-02
- Status: Approved for implementation
- Scope statement: This document is the **single source of truth** for the remediation initiative that aligns runtime/state architecture, release automation, and product documentation with confirmed decisions from the deep review session.

**Important:** This document is the authoritative source for all confirmed product decisions. Other PRDs should reference this document rather than duplicating decision details.

### Confirmed Product Decisions

- Match history is in scope and remains.
- Summary screen does not need a "Start New Game" action.
- Releases must support both `main` and `v*` branches.
- Schema and storage unification is required now.
- PRD lifecycle wording must remain Zepp OS v1-compatible.

### Detailed Confirmed Decisions

#### Decision 1: Match History Scope

**Decision**: Match history is **IN SCOPE** for v1.0  
**Previous status**: Listed as "Out of Scope" in original PRD.md Section 12  
**Correction date**: 2026-03-05

**Features included**:
- View list of completed matches
- View detailed match results (sets, games, scores)
- Delete individual matches from history
- Persistent storage across app restarts

**Implementation references**:
- UI: `page/history.js`, `page/history-detail.js`
- Storage: `utils/match-storage.js` (history functions)
- Data: Match history persisted separately from active session

**Acceptance**: Any PRD stating match history is out of scope is outdated. See PRD.md Section 12 (corrected) and this document.

---

#### Decision 2: Summary Screen Requirements

**Decision**: Summary screen does **NOT** require "Start New Game" button  
**Rationale**: New game flow is handled exclusively from Home Screen  
**Correction date**: 2026-03-05

**Correct behavior**:
- Summary screen shows: winner, final scores, set history
- Summary screen actions: Return to Home only
- New game flow: Home Screen → Start New Game → Setup → Game

**Implementation references**:
- Summary page: `page/summary.js`
- Home page: `page/index.js`

**Acceptance**: Any PRD requiring "Start New Game" on summary screen is incorrect. Users start new games from Home Screen only.

---

#### Decision 3: Release Branching Policy

**Decision**: Dual-stream release approach with main and version branches  
**Implementation date**: 2026-03-05 (Task #65)

**Release streams**:
1. **Main branch (`main`)**: Feature releases
   - Trigger: Push/merge to main
   - Tag format: `vX.Y.Z` (semantic versioning)
   - Examples: `v1.0.0`, `v1.1.0`, `v2.0.0`
   
2. **Version branches (`v*`)**: Maintenance and hotfix releases
   - Pattern: `v1.0.x`, `v1.1.x`, etc.
   - Tag format: `vX.Y.Z` (same semantic versioning as main; patch/minor bumps determined by commits)
   - Examples: `v1.0.1`, `v1.0.2`, `v1.1.1`
   - Channel: derived from branch name (e.g., `v1.0.x` branch → `1.0.x` channel)

**Implementation references**:
- Workflow: `.github/workflows/release.yml`
- Config: `.releaserc.json`
- Documentation: `RELEASE.md`

**Acceptance**: All PRDs must reference this dual-stream approach for release policy.

---

#### Decision 4: Zepp OS v1.0 Lifecycle Semantics

**Decision**: Use only Zepp OS v1.0-compatible lifecycle methods  
**Audit completion**: 2026-02-23 (Task #32)

**Available lifecycle methods**:
- `onInit(params)`: Page initialization, parse params, load data
- `build()`: Create UI widgets, render screen
- `onDestroy()`: Cleanup, persist state, release resources

**NOT available in v1.0** (removed in Task #32):
- `onShow()` - Not supported, pages are destroyed/recreated on navigation
- `onHide()` - Not supported, use `onDestroy()` for exit logic
- `onResume()` - Not supported, no page-stack persistence
- `onPause()` - Not supported, use `onDestroy()` for state persistence

**State persistence pattern**:
- **Entry**: `onInit()` → load persisted state
- **Exit**: `onDestroy()` → save current state
- **Navigation**: Always triggers destroy → init → build cycle

**Implementation references**:
- Audit summary: `.taskmaster/notes/lifecycle-audit-summary.md`
- Removed from: `page/index.js`, `page/setup.js`, `page/summary.js`, `page/game.js`
- Test update: `tests/home-screen.test.js`

**Acceptance**: Any PRD referencing `onShow/onHide/onResume/onPause` as available methods must be corrected. These methods do not exist in Zepp OS v1.0.

---

## 2. Executive Summary of Findings

### 2.1 Implementation Audit Findings

- Architecture: Active session state is split across multiple modules and legacy/modern contracts, creating drift and migration complexity.
- Correctness: Resume/start/reset paths rely on dual-write and fragile `globalData` handoff behavior that can fail under lifecycle timing.
- Maintainability: Core gameplay orchestration is overloaded in `page/game.js`, with duplicated helpers/constants across pages.
- Performance: Hot-path `JSON.stringify` comparisons increase per-interaction overhead during scoring and persistence checks.

### 2.2 PRD Coverage Findings

- Deep review baseline across 17 remediation controls: Covered `0`, Partial `17`, Not covered `0`.
- Major gaps:
  - No single canonical state and storage contract for active sessions.
  - Release policy (`main` + `v*`) not fully reflected in workflow/config behavior.
  - PRD language has scope/lifecycle inconsistencies with confirmed product decisions.

### 2.3 Documentation Freshness Findings

- `README.md`: stale setup/path and architecture descriptions.
- `CONTEXT.md`: incomplete Zepp OS v1 lifecycle/API coverage.
- `RELEASE.md`: diverges from current workflow and branch gating behavior.
- `CHANGELOG.md`: duplicate `1.0.0` history blocks require normalization.
- `docs/UI-SYSTEM.md`: expected reference is missing.

## 3. Problem Statement and Goals

### 3.1 Problem Statement

Current implementation and docs are not consistently aligned with confirmed product decisions. Runtime state management uses overlapping schemas and persistence paths, release automation does not fully represent approved branch policy, and PRD/documentation language contains scope and lifecycle drift.

### 3.2 Goals

- Establish one canonical active-session contract and one storage abstraction.
- Preserve reliable resume/new-match/reset behavior under Zepp OS v1 lifecycle semantics.
- Align CI/release automation with `main` and `v*` branch policy.
- Bring PRD/docs into one consistent, conflict-free narrative.
- Maintain or improve maintainability and scoring interaction responsiveness.

### 3.3 Non-Goals

- Do not change scoring rules or tie-break behavior.
- Do not introduce cloud sync/accounts.
- Do not adopt Zepp OS v2+ lifecycle APIs.
- Do not de-scope match history.
- Summary screen "Start New Game" is not required.

## 4. Detailed Requirements by Epic

### E1. State + Storage Unification (PAD-53 to PAD-58)

- Functional requirements:
  - Define and enforce one canonical active match session schema.
  - Use one persistence service path for active session read/write/clear.
  - Remove dual-write and `globalData` pending handoff dependencies from runtime flows.
  - Ensure deterministic `matchStartTime` initialization and consistent history timestamp semantics.
- Technical requirements:
  - Keep temporary dual-read migration compatibility for legacy key cutover only.
  - Preserve hmFS fallback behavior and safe handling of corrupted payloads.
  - Consolidate schema ownership to avoid ambiguity between runtime and persisted models.
  - Keep behavior backward compatible for start/resume/finish/reset flows.
- Acceptance criteria:
  - No production path dual-writes active session state.
  - Resume visibility and restoration remain correct after lifecycle and navigation transitions.
  - New unification regression tests fail on legacy behavior and pass on unified behavior.
- Risks:
  - High risk of persistence regressions and potential data loss during cutover.
  - Medium-high risk for timing regressions in immediate post-navigation resume behavior.
- Test and verification requirements:
  - Run full test suite and `npm run complete-check`.
  - Targeted manual verification for start, score, sleep/exit, reopen, and resume exactness.
  - Migration verification for legacy-key read compatibility and clear/reset correctness.

### E2. Maintainability + Performance (PAD-59 to PAD-62)

- Functional requirements:
  - Centralize duplicated constants and validation helpers.
  - Remove hot-path full-state stringify comparisons.
  - Decompose `page/game.js` into focused orchestration boundaries.
  - Optionally remove remaining screen helper duplication.
- Technical requirements:
  - Preserve gameplay outcomes and navigation behavior while refactoring.
  - Use deterministic signature/diff strategy in place of repeated deep stringify checks.
  - Keep module boundaries explicit (session access, persistence coordinator, scoring actions, render helpers).
- Acceptance criteria:
  - Canonical helper usage replaces redundant local definitions.
  - `page/game.js` is reduced to page wiring/orchestration responsibilities.
  - Interaction latency remains within existing target behavior.
- Risks:
  - Medium to medium-high regression risk from refactor depth.
  - Risk of subtle equality/diff errors when replacing stringify checks.
- Test and verification requirements:
  - Unit tests for conversion/validation helpers and scoring parity.
  - Performance-oriented checks for scoring interaction hot paths.
  - Manual smoke tests on round and square layouts.

### E3. Release Automation Alignment (PAD-63 to PAD-65)

- Functional requirements:
  - CI must trigger on `main` and `v*` branches.
  - Release workflow and semantic-release branch rules must support `main` and `v*` consistently.
  - Release documentation must reflect actual automation behavior 1:1.
- Technical requirements:
  - Keep existing quality gates/path filters unless explicitly superseded.
  - Maintain explicit guard clauses to prevent releases from non-approved refs.
  - Ensure branch/channel behavior is deterministic and auditable.
- Acceptance criteria:
  - Successful CI runs are valid release inputs for both branch patterns.
  - `release:dry` produces expected outcomes on representative `main` and `v*` refs.
  - `RELEASE.md` matches workflow and `.releaserc.json` behavior.
- Risks:
  - Medium risk of accidental release if branch guards are incomplete.
- Test and verification requirements:
  - Workflow validation/lint plus dry-run release checks.
  - Controlled branch-condition verification for `main` and `v*`.

### E4. Documentation + PRD Consistency (PAD-66 to PAD-69)

- Functional requirements:
  - Update PRD/docs to remove scope/lifecycle contradictions.
  - Confirm history in scope and summary behavior without required start-new-game action.
  - Refresh README and CONTEXT to current architecture and Zepp OS v1 constraints.
  - Repair CHANGELOG baseline structure and optionally add UI system reference doc.
- Technical requirements:
  - Use Zepp OS v1-compatible lifecycle terminology only.
  - Ensure docs are internally consistent and aligned with implemented behavior.
  - Keep semantic-release compatibility when normalizing changelog history.
- Acceptance criteria:
  - No conflicting statements across scoped PRD/doc set.
  - One authoritative `1.0.0` section in `CHANGELOG.md`.
  - Optional `docs/UI-SYSTEM.md` accurately documents current utility APIs.
- Risks:
  - Low risk overall; medium risk only for changelog history integrity if edited incorrectly.
- Test and verification requirements:
  - Grep-based contradiction audit for prohibited lifecycle terms and scope conflicts.
  - Manual doc-to-code/workflow consistency review.

## 5. Backlog Mapping

| Task | Objective | Dependencies | DoD signal |
| --- | --- | --- | --- |
| PAD-53 | Define canonical active-session contract | None | Canonical contract documented and unambiguous ownership established |
| PAD-54 | Unify storage abstractions under one service | PAD-53 | Single active-session write path with migration dual-read compatibility |
| PAD-55 | Remove dual runtime persistence across app/pages | PAD-54 | No dual-write in production flows; resume/start/reset parity preserved |
| PAD-56 | Remove fragile `globalData` pending handoffs | PAD-55 | Resume and navigation flows work without pending handoff keys |
| PAD-57 | Fix `matchStartTime` and history timestamp contract | PAD-55 | Deterministic initialization and consistent history timing fields |
| PAD-58 | Add unification regression suite | PAD-53, PAD-54, PAD-55, PAD-56, PAD-57 | Tests explicitly cover migration, lifecycle, resume, and reset correctness |
| PAD-59 | Consolidate duplicated constants/helpers | PAD-55 | Shared helper module replaces redundant local definitions |
| PAD-60 | Remove stringify hot-path comparisons | PAD-55 | No per-interaction full-state stringify in scoring hot path |
| PAD-61 | Decompose `page/game.js` responsibilities | PAD-55, PAD-59 | Focused modules extracted; page file reduced to orchestration wiring |
| PAD-62 | Optional cleanup of screen helper duplication | PAD-61 | Single shared screen metrics helper path in game page |
| PAD-63 | Expand CI triggers to `main` and `v*` | None | CI runs on push for both branch patterns |
| PAD-64 | Align release workflow and semantic-release branch gating | PAD-63 | Release job and branch rules support `main` and `v*` safely |
| PAD-65 | Update release documentation | PAD-63, PAD-64 | `RELEASE.md` matches workflow/config behavior 1:1 |
| PAD-66 | Align PRD scope/lifecycle decisions | None | Scoped PRD docs reflect confirmed decisions with no conflicts |
| PAD-67 | Refresh README and CONTEXT | PAD-66 | Repo setup/architecture/API docs match current implementation |
| PAD-68 | Repair duplicate changelog baseline | PAD-65 | Single authoritative `1.0.0` section retained with semantic-release compatibility |
| PAD-69 | Optional `docs/UI-SYSTEM.md` | PAD-67 | UI system reference exists and matches current utility exports |

## 6. Validation Matrix

- Required QA gate: `npm run complete-check`.

| Area | Scenario | Expected result | Evidence |
| --- | --- | --- | --- |
| Persistence | Start match, score, sleep/exit, relaunch | Exact state restored without loss | Automated tests + manual device/simulator run |
| Resume flow | Home resume visibility and resume action after relaunch | Resume shown only for valid unfinished session; restores latest state | Integration tests + manual checks |
| Lifecycle behavior | Save on lifecycle transitions supported in Zepp OS v1 contract | No crash, deterministic save/load behavior | Lifecycle-focused regression tests |
| Reset behavior | Start new game from active/finished contexts | Prior active session cleared once; new session initialized correctly | Integration tests + storage key assertions |
| Migration | Legacy key data present during upgrade path | Session is read safely via compatibility path | Unit migration tests |
| Release workflow | CI and release logic on `main` and `v*` | Correct trigger and branch gating for both patterns | Workflow validation + `release:dry` runs |

## 7. Rollout and Sequencing Plan

### 7.1 Recommended PR Sequence

- PR-1: `feature/PAD-53-canonical-state-and-storage-contract` (PAD-53, PAD-54)
- PR-2: `feature/PAD-55-runtime-unification-and-handoff-removal` (PAD-55, PAD-56, PAD-57)
- PR-3: `feature/PAD-58-unification-regression-tests` (PAD-58)
- PR-4: `feature/PAD-63-release-v-branch-support` (PAD-63, PAD-64, PAD-65)
- PR-5: `feature/PAD-66-prd-and-doc-consistency` (PAD-66, PAD-67, PAD-68)
- PR-6 (optional): `feature/PAD-61-game-page-maintainability` (PAD-59, PAD-60, PAD-61, PAD-62 optional, PAD-69 optional)

### 7.2 Rollback Strategy for High-Risk Unification Changes

- Keep migration compatibility as dual-read only during transition; do not reintroduce dual-write.
- If regressions appear in PR-2, rollback page-level integration points first while preserving unified storage internals from PR-1.
- Use targeted rollback by epic boundary to avoid mixing runtime and documentation reverts.
- Require green `npm run complete-check` and targeted resume/lifecycle scenarios before advancing to next PR.

## 8. Out of Scope and Guardrails

- No scoring rule changes.
- No Zepp OS v2+ lifecycle APIs.
- No cloud sync or account features.
- No match history de-scope.
- No summary-screen requirement for "Start New Game".
- No big-bang rewrite that removes migration compatibility in one step.

## 9. How to Use This Document

This PRD-Review.md is the **single source of truth** for confirmed product decisions.

### For Other PRDs
- Reference this document for shared decisions
- Do not duplicate decision details in individual PRDs
- Add "See PRD-Review.md Section X" for relevant decisions
- Update this document if new decisions are confirmed

### For Developers
- Check this document before implementing features
- If implementation contradicts this document, escalate for clarification
- Update this document when product decisions change

### For Stakeholders
- This document reflects the latest confirmed product direction
- Individual PRDs may contain outdated information if not yet updated
- Always reference this document for current decisions

## 10. Source References

### Key code and config surfaces

- `page/game.js`
- `page/index.js`
- `page/setup.js`
- `page/summary.js`
- `app.js`
- `utils/storage.js`
- `utils/match-storage.js`
- `utils/match-state.js`
- `utils/match-state-schema.js`
- `utils/start-new-match-flow.js`
- `utils/app-data-clear.js`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.releaserc.json`

### Key docs reviewed

- `docs/plan/Plan 53 Create a concrete execution backlog for confirmed product decisions and audit remediation.md`
- `docs/PRD.md`
- `docs/PRD-QA-Remediation-v1.1.md`
- `docs/PRD-Finish-Match.md`
- `docs/PRD-Refactor-Layout.md`
- `docs/match-state-integration.md`
- `README.md`
- `CONTEXT.md`
- `RELEASE.md`
- `CHANGELOG.md`
