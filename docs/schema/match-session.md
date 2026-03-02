# Match Session Contract

This document defines the canonical persisted match session contract used by active-session persistence, resume logic, and match history integrations.

- Canonical schema: `docs/schema/match-session.json`
- Runtime owner: `utils/match-state-schema.js`
- Current version: `schemaVersion = 2`

## Contract shape

Top-level required groups:

- `teams`
- `scores`
- `settings`
- `status`
- `metadata`
- `timing`
- `setHistory`
- `schemaVersion`

Backward-compatible mirror fields are also persisted for existing runtime integrations:

- `setsToPlay`, `setsNeededToWin`
- `setsWon`, `currentSet`, `currentGame`
- `updatedAt`

These mirrors are derived from canonical groups and must stay aligned.

## Timestamp rules

- Canonical timestamps live in `timing` as ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- `updatedAt` is kept as a non-negative unix epoch millisecond mirror for compatibility.
- `status = finished` requires `timing.finishedAt`.
- `status = active|paused` requires `timing.finishedAt = null`.

## Migration flow

Runtime migration path is managed in `utils/match-state-schema.js`:

1. `v0` (no schemaVersion) -> `v1`
2. `v1` (legacy top-level-only structure) -> `v2` canonical contract

`deserializeMatchSession` attempts migration and returns `null` for invalid payloads.
`migrateMatchState` attempts migration and falls back to a default empty session when migration fails.

## Backward compatibility policy

- Additive-first: new fields are added with migration defaults.
- No silent removals: existing persisted fields are not removed without a migration path.
- One-way versioning: older payloads are upgraded to the current version during deserialization.
- Unknown future versions are rejected until explicit migration support is added.

## Version bump checklist

When introducing `schemaVersion = N + 1`:

1. Add migration from `N -> N+1` in `migrationRegistry`.
2. Update JSON schema `const` for `schemaVersion`.
3. Update TypeScript contract definitions.
4. Add/adjust tests for migration and round-trip behavior.
5. Keep compatibility mirrors available until callers no longer depend on them.
