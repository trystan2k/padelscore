import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CURRENT_SCHEMA_VERSION,
  createDefaultMatchState,
  deserializeMatchSession,
  deserializeMatchState,
  MATCH_STATUS,
  migrateMatchState,
  SETS_NEEDED_TO_WIN,
  SETS_TO_PLAY,
  serializeMatchSession,
  serializeMatchState,
  validateMatchSession
} from '../utils/match-state-schema.js'
import {
  activeInProgressSession,
  emptyNewSession,
  finishedSessionWithHistory,
  specialCharacterTeamNamesSession
} from './fixtures/match-session-examples.js'

function createLegacyV0Payload(overrides = {}) {
  return {
    status: 'active',
    setsToPlay: 3,
    setsNeededToWin: 2,
    setsWon: {
      teamA: 1,
      teamB: 0
    },
    currentSet: {
      number: 2,
      games: {
        teamA: 4,
        teamB: 3
      }
    },
    currentGame: {
      points: {
        teamA: 30,
        teamB: 15
      }
    },
    setHistory: [{ setNumber: 1, teamAGames: 6, teamBGames: 4 }],
    updatedAt: 1704067800000,
    ...overrides
  }
}

test('validateMatchSession accepts canonical example sessions', () => {
  assert.equal(validateMatchSession(emptyNewSession), true)
  assert.equal(validateMatchSession(activeInProgressSession), true)
  assert.equal(validateMatchSession(finishedSessionWithHistory), true)
  assert.equal(validateMatchSession(specialCharacterTeamNamesSession), true)
})

test('serializeMatchState and deserializeMatchState round-trip canonical payload', () => {
  const serialized = serializeMatchState(activeInProgressSession)
  const deserialized = deserializeMatchState(serialized)

  assert.notEqual(deserialized, null)
  assert.deepEqual(deserialized, activeInProgressSession)
})

test('canonical ISO timestamps remain valid when Date.parse returns NaN', () => {
  const originalDateParse = Date.parse
  Date.parse = () => Number.NaN

  try {
    assert.equal(validateMatchSession(activeInProgressSession), true)

    const serialized = serializeMatchState(activeInProgressSession)
    const deserialized = deserializeMatchState(serialized)

    assert.notEqual(deserialized, null)
    assert.equal(
      deserialized?.timing.updatedAt,
      activeInProgressSession.timing.updatedAt
    )
    assert.equal(validateMatchSession(deserialized), true)
  } finally {
    Date.parse = originalDateParse
  }
})

test('createDefaultMatchState creates independent objects across factory calls', () => {
  const firstState = createDefaultMatchState()
  const secondState = createDefaultMatchState()

  firstState.scores.setsWon.teamA = 1
  firstState.scores.currentSet.games.teamA = 4
  firstState.scores.currentGame.points.teamA = 15

  assert.equal(secondState.scores.setsWon.teamA, 0)
  assert.equal(secondState.scores.currentSet.games.teamA, 0)
  assert.equal(secondState.scores.currentGame.points.teamA, 0)
  assert.notEqual(firstState.scores, secondState.scores)
  assert.notEqual(firstState.settings, secondState.settings)
  assert.notEqual(firstState.setHistory, secondState.setHistory)
})

test('deserializeMatchSession returns detached score graph for canonical payloads', () => {
  const deserialized = deserializeMatchSession(
    serializeMatchSession(activeInProgressSession)
  )

  assert.notEqual(deserialized, null)
  assert.notEqual(deserialized?.scores.setsWon, deserialized?.setsWon)
  assert.notEqual(deserialized?.scores.currentSet, deserialized?.currentSet)
  assert.notEqual(
    deserialized?.scores.currentSet.games,
    deserialized?.currentSet.games
  )
  assert.notEqual(deserialized?.scores.currentGame, deserialized?.currentGame)
  assert.notEqual(
    deserialized?.scores.currentGame.points,
    deserialized?.currentGame.points
  )
})

test('validateMatchSession and deserializeMatchSession reject negative score values', () => {
  const invalidCandidate = {
    ...emptyNewSession,
    scores: {
      ...emptyNewSession.scores,
      setsWon: {
        teamA: -1,
        teamB: 0
      }
    },
    setsWon: {
      teamA: -1,
      teamB: 0
    }
  }

  assert.equal(validateMatchSession(invalidCandidate), false)
  assert.equal(deserializeMatchSession(JSON.stringify(invalidCandidate)), null)
})

test('serializeMatchSession and deserializeMatchSession normalize legacy v1 payloads to v2', () => {
  const legacyV1Payload = {
    status: 'active',
    setsToPlay: 3,
    setsNeededToWin: 2,
    setsWon: {
      teamA: 1,
      teamB: 0
    },
    currentSet: {
      number: 2,
      games: {
        teamA: 4,
        teamB: 3
      }
    },
    currentGame: {
      points: {
        teamA: 30,
        teamB: 15
      }
    },
    setHistory: [{ setNumber: 1, teamAGames: 6, teamBGames: 4 }],
    updatedAt: 1704067800000,
    schemaVersion: 1
  }

  const migrated = deserializeMatchSession(JSON.stringify(legacyV1Payload))

  assert.notEqual(migrated, null)
  assert.equal(migrated?.schemaVersion, CURRENT_SCHEMA_VERSION)
  assert.equal(migrated?.settings.setsToPlay, 3)
  assert.equal(migrated?.scores.currentSet.games.teamA, 4)
  assert.equal(migrated?.updatedAt, legacyV1Payload.updatedAt)
  assert.equal(validateMatchSession(migrated), true)

  const serializedMigrated = serializeMatchSession(legacyV1Payload)
  const reparsedMigrated = deserializeMatchSession(serializedMigrated)
  assert.equal(validateMatchSession(reparsedMigrated), true)
})

test('deserializeMatchSession migrates explicit schemaVersion 0 payloads through legacy path', () => {
  const legacyV0Payload = createLegacyV0Payload({
    schemaVersion: 0
  })

  const migrated = deserializeMatchSession(JSON.stringify(legacyV0Payload))

  assert.notEqual(migrated, null)
  assert.equal(migrated?.schemaVersion, CURRENT_SCHEMA_VERSION)
  assert.equal(migrated?.updatedAt, legacyV0Payload.updatedAt)
  assert.equal(validateMatchSession(migrated), true)
})

test('migrateMatchState deep-clones nested structures when upgrading legacy payloads', () => {
  const legacyV1Payload = {
    ...createLegacyV0Payload(),
    schemaVersion: 1
  }

  const migrated = migrateMatchState(legacyV1Payload)

  assert.equal(validateMatchSession(migrated), true)
  assert.notEqual(migrated.setsWon, legacyV1Payload.setsWon)
  assert.notEqual(migrated.currentSet, legacyV1Payload.currentSet)
  assert.notEqual(migrated.currentSet.games, legacyV1Payload.currentSet.games)
  assert.notEqual(migrated.currentGame, legacyV1Payload.currentGame)
  assert.notEqual(
    migrated.currentGame.points,
    legacyV1Payload.currentGame.points
  )
  assert.notEqual(migrated.setHistory, legacyV1Payload.setHistory)

  legacyV1Payload.setsWon.teamA = 99
  legacyV1Payload.currentSet.games.teamA = 99
  legacyV1Payload.currentGame.points.teamA = 99
  legacyV1Payload.setHistory[0].teamAGames = 99

  assert.equal(migrated.setsWon.teamA, 1)
  assert.equal(migrated.currentSet.games.teamA, 4)
  assert.equal(migrated.currentGame.points.teamA, 30)
  assert.equal(migrated.setHistory[0].teamAGames, 6)
})

test('migrateMatchState falls back to canonical default for corrupted legacy payloads', () => {
  const corruptedLegacyPayload = createLegacyV0Payload({
    schemaVersion: 0,
    setsToPlay: 1,
    setsNeededToWin: 1,
    setsWon: {
      teamA: -1,
      teamB: 0
    }
  })

  const migrated = migrateMatchState(corruptedLegacyPayload)

  assert.equal(validateMatchSession(migrated), true)
  assert.equal(migrated.status, MATCH_STATUS.ACTIVE)
  assert.equal(migrated.setsToPlay, SETS_TO_PLAY.THREE)
  assert.equal(migrated.setsNeededToWin, SETS_NEEDED_TO_WIN.TWO)
})

test('deserializeMatchSession accepts numeric timing fields and normalizes to ISO timestamps', () => {
  const candidate = {
    ...emptyNewSession,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timing: {
      createdAt: 1704067200000,
      updatedAt: 1704067500000,
      startedAt: 1704067200000,
      finishedAt: null
    },
    updatedAt: 1704067500000
  }

  const deserialized = deserializeMatchSession(JSON.stringify(candidate))

  assert.notEqual(deserialized, null)
  assert.equal(typeof deserialized?.timing.createdAt, 'string')
  assert.equal(deserialized?.timing.updatedAt, '2024-01-01T00:05:00.000Z')
  assert.equal(deserialized?.updatedAt, 1704067500000)
  assert.equal(validateMatchSession(deserialized), true)
})

test('deserializeMatchSession accepts parseable string timing fields and normalizes to canonical ISO', () => {
  const candidate = {
    ...emptyNewSession,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timing: {
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:05:00Z',
      startedAt: '2024-01-01T00:00:00Z',
      finishedAt: null
    },
    updatedAt: 1704067500000
  }

  const deserialized = deserializeMatchSession(JSON.stringify(candidate))

  assert.notEqual(deserialized, null)
  assert.equal(deserialized?.timing.createdAt, '2024-01-01T00:00:00.000Z')
  assert.equal(deserialized?.timing.updatedAt, '2024-01-01T00:05:00.000Z')
  assert.equal(deserialized?.timing.startedAt, '2024-01-01T00:00:00.000Z')
  assert.equal(validateMatchSession(deserialized), true)
})

test('deserializeMatchSession repairs missing startedAt using earliest reliable start timestamp', () => {
  const candidate = {
    ...emptyNewSession,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    matchStartTime: '2024-01-01T00:00:05Z',
    startedAt: '2024-01-01T00:00:20Z',
    timing: {
      ...emptyNewSession.timing,
      createdAt: '2024-01-01T00:00:30Z',
      updatedAt: '2024-01-01T00:05:00Z',
      startedAt: null,
      finishedAt: null
    },
    updatedAt: 1704067500000
  }

  const deserialized = deserializeMatchSession(JSON.stringify(candidate))

  assert.notEqual(deserialized, null)
  assert.equal(deserialized?.timing.startedAt, '2024-01-01T00:00:05.000Z')
  assert.equal(validateMatchSession(deserialized), true)
})

test('deserializeMatchSession maps legacy created_at semantics to createdAt and startedAt fallback', () => {
  const legacyV1Payload = {
    ...createLegacyV0Payload(),
    schemaVersion: 1,
    created_at: 1704067000000
  }

  const deserialized = deserializeMatchSession(JSON.stringify(legacyV1Payload))

  assert.notEqual(deserialized, null)
  assert.equal(deserialized?.timing.createdAt, '2023-12-31T23:56:40.000Z')
  assert.equal(deserialized?.timing.startedAt, '2023-12-31T23:56:40.000Z')
  assert.equal(validateMatchSession(deserialized), true)
})

test('validateMatchSession rejects invalid status and timing combinations', () => {
  const invalidStatus = {
    ...emptyNewSession,
    status: 'stopped'
  }
  const invalidFinishedTiming = {
    ...finishedSessionWithHistory,
    timing: {
      ...finishedSessionWithHistory.timing,
      finishedAt: null
    }
  }

  assert.equal(validateMatchSession(invalidStatus), false)
  assert.equal(validateMatchSession(invalidFinishedTiming), false)
})

test('deserializeMatchState returns null for malformed and partial payloads', () => {
  assert.equal(deserializeMatchState('{bad-json'), null)

  const {
    scores: _scores,
    currentGame: _currentGame,
    ...partialPayload
  } = emptyNewSession
  assert.equal(deserializeMatchState(JSON.stringify(partialPayload)), null)
})

test('migrateMatchState returns canonical default for unsupported future schemas', () => {
  const migrated = migrateMatchState({
    ...emptyNewSession,
    schemaVersion: CURRENT_SCHEMA_VERSION + 1
  })

  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION)
  assert.equal(migrated.status, MATCH_STATUS.ACTIVE)
  assert.equal(migrated.setsToPlay, SETS_TO_PLAY.THREE)
  assert.equal(migrated.setsNeededToWin, SETS_NEEDED_TO_WIN.TWO)
  assert.equal(validateMatchSession(migrated), true)
})

test('migrateMatchState preserves identity for already-canonical payload', () => {
  const state = createDefaultMatchState()
  assert.strictEqual(migrateMatchState(state), state)
})
