---
title: Task 65 Update Release Workflow and .releaserc for Main and Version Branches
type: note
permalink: development-logs/task-65-update-release-workflow-and-.releaserc-for-main-and-version-branches
---

# Development Log: Task 65

## Metadata
- Task ID: 65
- Date (UTC): 2026-03-03T20:39:37Z
- Project: padelbuddy
- Branch: feature/PAD-65-update-release-workflow-and-releaserc-for-main-and-version-branches
- Commit: n/a

## Objective
- Update semantic-release and release workflow to support dual release streams (main and v* maintenance branches) while preserving existing publish policy.

## Implementation Summary
- Implemented dual-stream semantic-release configuration and workflow changes to allow releases from both main and v* maintenance branches.
- Preserved existing npmPublish: false policy and explicit tag format compatible with historical v* tags.
- Added workflow_run filters and conditional logic in the release workflow to limit release eligibility to main and v* branches and retained skip-ci safeguards.
- Updated RELEASE.md with explicit dry-run guidance for both main and maintenance branch contexts.
- Added planning artifact in docs/plan/ ("Plan 65 Update Release Workflow and .releaserc for Main and Version Branches.md").
- Applied a post-review doc fix to make maintenance dry-run branch switch explicit.

## Files Changed
- .releaserc.json
- .github/workflows/release.yml
- RELEASE.md
- docs/plan/Plan 65 Update Release Workflow and .releaserc for Main and Version Branches.md

## Key Decisions
- Keep existing release architecture; do not split workflows or introduce new registry targets or secrets.
- Configure semantic-release to handle two branch streams: main and v* (maintenance) pattern.
- Use an explicit tagFormat to be compatible with existing v* history and tags.
- Extend workflow_run release eligibility to main and v* only; keep skip-ci safeguards intact.
- Provide dry-run validation guidance for both streams without creating extra remote test branches.

## Validation Performed
- JSON validation: node parse of .releaserc.json -> pass
- semantic-release dry-run for main branch context -> config loaded, no publish, dry-run validated
- semantic-release dry-run for simulated v1.0.x maintenance context -> config loaded, no publish, dry-run validated
- Project QA: npm run complete-check -> pass (lint/format/tests successful, 460 tests passed)
- Independent QA: npm run lint, npm run format:check, npm test -> all pass

## Code Review and Fix Loop
- Initial review requested doc fix: RELEASE.md dry-run instructions lacked explicit branch switch guidance.
- Fix applied: updated RELEASE.md dry-run section with explicit git switch/checkout guidance for main and maintenance contexts.
- Re-review: approved; all subtasks and plan requirements satisfied.

## Taskmaster Status
- In-progress set for: 65, 65.1, 65.2, 65.3, 65.4, 65.5
- Final status set to done for: 65, 65.1, 65.2, 65.3, 65.4, 65.5

## Risks and Follow-ups
- Risk: Misconfigured tagFormat could conflict with historical tags — mitigated by using explicit, backward-compatible tagFormat and validation dry-runs.
- Follow-up: Monitor next maintenance branch release to ensure tag continuity and that CI skip safeguards behave as expected.
