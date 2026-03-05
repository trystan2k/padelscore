---
title: Task 66 PAD-65 Update RELEASE.md to Reflect Actual Automation and Policy
type: note
permalink: development-logs/task-66-pad-65-update-release.md-to-reflect-actual-automation-and-policy
---

# Development Log: Task 66 PAD-65 Update RELEASE.md to Reflect Actual Automation and Policy

## Metadata
- Task ID: 66
- Date (UTC): 2026-03-05T00:00:00Z
- Project: padelbuddy
- Branch: feature/PAD-66-update-release-md-to-reflect-actual-automation-and-policy
- Commit: n/a

## Objective
- Update RELEASE.md to accurately reflect the repository's actual automation and release policy with minimal, targeted documentation changes.

## Implementation Summary
- Performed targeted updates to RELEASE.md to correct two discrepancies and improve wording clarity. Changes are documentation-only and limited to RELEASE.md.
- Added missing CI quality checks, clarified path filtering behavior, and applied two minor code-review fixes.

## Files Changed
- RELEASE.md

## What Changed (details)
1. Quality Checks Section (Lines 336-342)
   - Added missing quality checks:
     - `npm run format:check` - Format check (no auto-fix)
     - `npm run test:unification` - Unification regression suite
   - Documented correct CI execution order now as:
     1. `npm run lint`
     2. `npm run format:check`
     3. `npm run test`
     4. `npm run test:unification`

2. Path Filtering Section (Lines 75-118)
   - Clarified distinction between CI `paths-ignore` (prevents CI workflow from running on push events) and release `releasable paths` (determines whether a release should be created).
   - Added an explanatory table, explicit CI `paths-ignore` list, explicit release `releasable paths` list, and a callout note emphasizing the distinction.

3. Code Review Fixes (2 small fixes)
   - Line 115: Expanded `*.md` comment to explicitly mention README.md, AGENTS.md, CONTEXT.md.
   - Line 81: Clarified that CI `paths-ignore` only applies to push events and not pull requests (PRs).

## Key Decisions
- Use minimal, targeted edits to ensure RELEASE.md matches actual CI and release behaviors without changing workflow logic.
- Document `format:check` and `test:unification` as explicit CI checks to improve developer clarity and QA reproducibility.

## Validation Performed
- QA command: `npm run complete-check` - pass
  - Lint: 81 files checked, no issues
  - Format: 81 files formatted, no changes
  - Tests: 460 tests passed, 0 failed
- Cross-references performed:
  - `.github/workflows/ci.yml` - Confirmed CI checks and paths-ignore
  - `.github/workflows/release.yml` - Confirmed releasable path logic
  - `.releaserc.json` - Confirmed release configuration
  - `package.json` - Confirmed documented npm scripts exist
- First QA run: Passed (before code review fixes)
- Second QA run: Passed (after code review fixes)

## Risks and Follow-ups
- Risk: Documentation drift if workflows change and RELEASE.md is not updated in sync. Follow-up: include a maintenance note to review RELEASE.md when CI or release workflows are modified.
- No functional risks; documentation-only changes.

## Review
- Initial review found 2 minor issues (incomplete `*.md` comment and overbroad `paths-ignore` scope) which were fixed.
- Re-review: All issues resolved, ready for merge.

## Outcome
- Task completed successfully. RELEASE.md now accurately reflects automation and policy.

