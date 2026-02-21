import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CURRENT_SCHEMA_VERSION,
  MATCH_STATUS,
  SETS_NEEDED_TO_WIN,
  SETS_TO_PLAY,
  createDefaultMatchState,
  deserializeMatchState,
  migrateMatchState,
  serializeMatchState
} from '../utils/match-state-schema.js'

test('serializeMatchState and deserializeMatchState preserve a valid MatchState payload', () => {
  const state = createDefaultMatchState()

  state.status = MATCH_STATUS.FINISHED
  state.setsToPlay = SETS_TO_PLAY.FIVE
  state.setsNeededToWin = SETS_NEEDED_TO_WIN.THREE
  state.setsWon.teamA = 3
  state.currentSet.number = 4
  state.currentSet.games.teamA = 6
  state.currentSet.games.teamB = 4
  state.currentGame.points.teamA = 2
  state.currentGame.points.teamB = 1
  state.setHistory = [
    { setNumber: 1, teamAGames: 6, teamBGames: 4 },
    { setNumber: 2, teamAGames: 3, teamBGames: 6 },
    { setNumber: 3, teamAGames: 7, teamBGames: 6 }
  ]
  state.updatedAt = 1700000000000
  state.schemaVersion = CURRENT_SCHEMA_VERSION

  const serializedState = serializeMatchState(state)
  const deserializedState = deserializeMatchState(serializedState)

  assert.deepEqual(deserializedState, state)
})

test('createDefaultMatchState returns independent nested objects on every call', () => {
  const firstState = createDefaultMatchState()
  const secondState = createDefaultMatchState()

  assert.notStrictEqual(firstState, secondState)
  assert.notStrictEqual(firstState.setsWon, secondState.setsWon)
  assert.notStrictEqual(firstState.currentSet, secondState.currentSet)
  assert.notStrictEqual(firstState.currentSet.games, secondState.currentSet.games)
  assert.notStrictEqual(firstState.currentGame, secondState.currentGame)
  assert.notStrictEqual(firstState.currentGame.points, secondState.currentGame.points)
  assert.notStrictEqual(firstState.setHistory, secondState.setHistory)

  firstState.setsWon.teamA = 1
  firstState.currentSet.games.teamA = 6
  firstState.currentGame.points.teamA = 3
  firstState.setHistory.push({
    setNumber: 1,
    teamAGames: 6,
    teamBGames: 4
  })

  assert.deepEqual(secondState.setsWon, {
    teamA: 0,
    teamB: 0
  })
  assert.deepEqual(secondState.currentSet.games, {
    teamA: 0,
    teamB: 0
  })
  assert.deepEqual(secondState.currentGame.points, {
    teamA: 0,
    teamB: 0
  })
  assert.deepEqual(secondState.setHistory, [])
})

test('deserializeMatchState creates a detached object graph from serialized source', () => {
  const sourceState = createDefaultMatchState()
  sourceState.setHistory = [
    {
      setNumber: 1,
      teamAGames: 6,
      teamBGames: 4
    }
  ]

  const loadedState = deserializeMatchState(serializeMatchState(sourceState))

  assert.notEqual(loadedState, null)

  if (!loadedState) {
    return
  }

  loadedState.setsWon.teamA = 2
  loadedState.currentSet.games.teamA = 3
  loadedState.currentGame.points.teamA = 1
  loadedState.setHistory[0].teamAGames = 0

  assert.equal(sourceState.setsWon.teamA, 0)
  assert.equal(sourceState.currentSet.games.teamA, 0)
  assert.equal(sourceState.currentGame.points.teamA, 0)
  assert.equal(sourceState.setHistory[0].teamAGames, 6)
})

test('deserializeMatchState returns null for malformed JSON', () => {
  assert.equal(deserializeMatchState('{bad-json'), null)
})

test('deserializeMatchState returns null when required fields are missing', () => {
  const state = createDefaultMatchState()
  const { currentGame: _currentGame, ...invalidState } = state

  assert.equal(deserializeMatchState(JSON.stringify(invalidState)), null)
})

test('deserializeMatchState returns null for invalid enum values', () => {
  const state = createDefaultMatchState()
  const invalidState = {
    ...state,
    status: 'paused'
  }

  assert.equal(deserializeMatchState(JSON.stringify(invalidState)), null)
})

test('deserializeMatchState returns null for invalid set configuration', () => {
  const state = createDefaultMatchState()
  const invalidState = {
    ...state,
    setsToPlay: SETS_TO_PLAY.FIVE,
    setsNeededToWin: SETS_NEEDED_TO_WIN.ONE
  }

  assert.equal(deserializeMatchState(JSON.stringify(invalidState)), null)
})

test('deserializeMatchState returns null when score fields are negative', () => {
  const state = createDefaultMatchState()
  const invalidState = {
    ...state,
    setsWon: {
      teamA: -1,
      teamB: 0
    }
  }

  assert.equal(deserializeMatchState(JSON.stringify(invalidState)), null)
})

test('migrateMatchState upgrades legacy version 0 payloads to current schema version', () => {
  const state = createDefaultMatchState()
  const { schemaVersion: _schemaVersion, ...legacyState } = state

  const migratedState = migrateMatchState(legacyState)

  assert.deepEqual(migratedState, {
    ...legacyState,
    schemaVersion: CURRENT_SCHEMA_VERSION
  })
})

test('migrateMatchState upgrades explicit schemaVersion 0 payloads', () => {
  const state = createDefaultMatchState()
  const legacyState = {
    ...state,
    schemaVersion: 0
  }

  const migratedState = migrateMatchState(legacyState)

  assert.equal(migratedState.schemaVersion, CURRENT_SCHEMA_VERSION)
  assert.equal(migratedState.status, state.status)
  assert.equal(migratedState.setsToPlay, state.setsToPlay)
  assert.equal(migratedState.setsNeededToWin, state.setsNeededToWin)
})

test('migrateMatchState deep-clones legacy nested fields when upgrading from v0', () => {
  const state = createDefaultMatchState()
  const { schemaVersion: _schemaVersion, ...legacyState } = state
  legacyState.setHistory = [
    {
      setNumber: 1,
      teamAGames: 6,
      teamBGames: 4
    }
  ]

  const migratedState = migrateMatchState(legacyState)

  migratedState.setsWon.teamA = 2
  migratedState.currentSet.games.teamA = 3
  migratedState.currentGame.points.teamA = 1
  migratedState.setHistory[0].teamAGames = 0

  assert.equal(legacyState.setsWon.teamA, 0)
  assert.equal(legacyState.currentSet.games.teamA, 0)
  assert.equal(legacyState.currentGame.points.teamA, 0)
  assert.equal(legacyState.setHistory[0].teamAGames, 6)
})

test('migrateMatchState bypasses already current schema payloads unchanged', () => {
  const state = createDefaultMatchState()

  assert.strictEqual(migrateMatchState(state), state)
})

test('migrateMatchState falls back to default state when schema version is invalid', () => {
  const state = createDefaultMatchState()
  const migratedState = migrateMatchState({
    ...state,
    schemaVersion: '1'
  })

  assert.equal(migratedState.status, MATCH_STATUS.ACTIVE)
  assert.equal(migratedState.setsToPlay, SETS_TO_PLAY.THREE)
  assert.equal(migratedState.setsNeededToWin, SETS_NEEDED_TO_WIN.TWO)
  assert.equal(migratedState.schemaVersion, CURRENT_SCHEMA_VERSION)
})

test('migrateMatchState falls back to default state for unsupported future schema versions', () => {
  const state = createDefaultMatchState()
  const migratedState = migrateMatchState({
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION + 1
  })

  assert.equal(migratedState.status, MATCH_STATUS.ACTIVE)
  assert.equal(migratedState.setsToPlay, SETS_TO_PLAY.THREE)
  assert.equal(migratedState.setsNeededToWin, SETS_NEEDED_TO_WIN.TWO)
  assert.equal(migratedState.schemaVersion, CURRENT_SCHEMA_VERSION)
})

test('migrateMatchState falls back to default state for corrupted legacy payloads', () => {
  const migratedState = migrateMatchState({
    status: MATCH_STATUS.ACTIVE,
    setsToPlay: SETS_TO_PLAY.THREE,
    setsNeededToWin: SETS_NEEDED_TO_WIN.TWO,
    setsWon: {
      teamA: 0,
      teamB: 0
    },
    currentSet: {
      number: 1,
      games: {
        teamA: 0,
        teamB: 0
      }
    },
    currentGame: {
      points: {
        teamA: -1,
        teamB: 0
      }
    },
    setHistory: [],
    updatedAt: 1700000000000
  })

  assert.equal(migratedState.currentGame.points.teamA, 0)
  assert.equal(migratedState.currentGame.points.teamB, 0)
  assert.equal(migratedState.schemaVersion, CURRENT_SCHEMA_VERSION)
})
