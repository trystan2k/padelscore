---
title: Task 19 Implement New Match Reset and Cleanup.md
type: note
permalink: development-logs/task-19-implement-new-match-reset-and-cleanup.md
---

# Development Log: Task 19

## Metadata
- Task ID: 19
- Date (UTC): 2026-02-22T00:00:00Z
- Project: padelscore
- Branch: n/a
- Commit: n/a

## Objective
- Implement a robust new-match reset and cleanup flow that clears persisted session data, resets runtime state, and protects UI actions with confirmation/double-tap to avoid accidental resets.

## Implementation Summary
- Added clearActiveMatchSession() utility to clear both the current schema store and legacy storage to ensure no stale session data remains.
- Added resetMatchStateManager() utility to reset the in-memory/runtime match state manager to a clean initial state.
- Implemented startNewMatchFlow() orchestrator which performs: clearActiveMatchSession -> resetMatchStateManager -> navigate to match setup/summary, ensuring an ordered and safe transition when starting a new match.
- Wired the Summary screen 'Start New Game' button to startNewMatchFlow() and added double-tap protection to prevent accidental activation.
- Added a Home screen hard reset with a two-tap confirmation pattern and a 2.5s timeout window for the second tap (hard reset requires confirmation).

## Files Changed
- Not specified in input (file-level details not provided). See commit/branch metadata for exact file list when available.

## Key Decisions
- Dual-store clearing: clearActiveMatchSession() explicitly targets both the new schema-backed store and legacy storage to avoid leaving orphaned state.
- Runtime reset separated from persistence clear to ensure deterministic in-memory state after navigation.
- UI protection: double-tap / two-tap confirmation with a 2.5s window chosen to balance responsiveness and accidental activation protection.

## Validation Performed
- npm run test: pass - All 177 tests pass.
- Code review: approved with one minor documentation suggestion (non-blocking).

## Risks and Follow-ups
- Follow-up: apply the reviewer documentation suggestion (non-blocking) in a small docs patch.
- Follow-up: monitor QA for UX regressions around double-tap timing on target devices and adjust timeout if needed.
