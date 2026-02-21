import assert from 'node:assert/strict'
import test from 'node:test'

import {
  initializeMatchState,
  isSupportedSetsToPlay,
  SUPPORTED_SETS_TO_PLAY
} from '../utils/match-session-init.js'
import { MATCH_STATUS, SETS_TO_PLAY, SETS_NEEDED_TO_WIN } from '../utils/match-state-schema.js'

test('SUPPORTED_SETS_TO_PLAY contains canonical 1, 3, 5 set options', () => {
  assert.deepEqual(SUPPORTED_SETS_TO_PLAY, [1, 3, 5])
})

test('isSupportedSetsToPlay returns true for valid set counts', () => {
  assert.equal(isSupportedSetsToPlay(1), true)
  assert.equal(isSupportedSetsToPlay(3), true)
  assert.equal(isSupportedSetsToPlay(5), true)
})

test('isSupportedSetsToPlay returns false for invalid set counts', () => {
  assert.equal(isSupportedSetsToPlay(0), false)
  assert.equal(isSupportedSetsToPlay(2), false)
  assert.equal(isSupportedSetsToPlay(4), false)
  assert.equal(isSupportedSetsToPlay(7), false)
  assert.equal(isSupportedSetsToPlay(-1), false)
  assert.equal(isSupportedSetsToPlay(1.5), false)
  assert.equal(isSupportedSetsToPlay(null), false)
  assert.equal(isSupportedSetsToPlay(undefined), false)
  assert.equal(isSupportedSetsToPlay('1'), false)
  assert.equal(isSupportedSetsToPlay({}), false)
  assert.equal(isSupportedSetsToPlay([]), false)
})

test('initializeMatchState creates active match state for 1-set match', () => {
  const fixedTimestamp = 1700000000000
  const originalDateNow = Date.now

  Date.now = () => fixedTimestamp

  try {
    const state = initializeMatchState(SETS_TO_PLAY.ONE)

    assert.equal(state.status, MATCH_STATUS.ACTIVE)
    assert.equal(state.setsToPlay, 1)
    assert.equal(state.setsNeededToWin, 1)
    assert.deepEqual(state.setsWon, { teamA: 0, teamB: 0 })
    assert.deepEqual(state.currentSet, { number: 1, games: { teamA: 0, teamB: 0 } })
    assert.deepEqual(state.currentGame, { points: { teamA: 0, teamB: 0 } })
    assert.deepEqual(state.setHistory, [])
    assert.equal(state.updatedAt, fixedTimestamp)
    assert.equal(state.schemaVersion, 1)
  } finally {
    Date.now = originalDateNow
  }
})

test('initializeMatchState creates active match state for 3-set match', () => {
  const fixedTimestamp = 1700000001000
  const originalDateNow = Date.now

  Date.now = () => fixedTimestamp

  try {
    const state = initializeMatchState(SETS_TO_PLAY.THREE)

    assert.equal(state.status, MATCH_STATUS.ACTIVE)
    assert.equal(state.setsToPlay, 3)
    assert.equal(state.setsNeededToWin, 2)
    assert.deepEqual(state.setsWon, { teamA: 0, teamB: 0 })
    assert.deepEqual(state.currentSet, { number: 1, games: { teamA: 0, teamB: 0 } })
    assert.deepEqual(state.currentGame, { points: { teamA: 0, teamB: 0 } })
    assert.deepEqual(state.setHistory, [])
    assert.equal(state.updatedAt, fixedTimestamp)
    assert.equal(state.schemaVersion, 1)
  } finally {
    Date.now = originalDateNow
  }
})

test('initializeMatchState creates active match state for 5-set match', () => {
  const fixedTimestamp = 1700000002000
  const originalDateNow = Date.now

  Date.now = () => fixedTimestamp

  try {
    const state = initializeMatchState(SETS_TO_PLAY.FIVE)

    assert.equal(state.status, MATCH_STATUS.ACTIVE)
    assert.equal(state.setsToPlay, 5)
    assert.equal(state.setsNeededToWin, 3)
    assert.deepEqual(state.setsWon, { teamA: 0, teamB: 0 })
    assert.deepEqual(state.currentSet, { number: 1, games: { teamA: 0, teamB: 0 } })
    assert.deepEqual(state.currentGame, { points: { teamA: 0, teamB: 0 } })
    assert.deepEqual(state.setHistory, [])
    assert.equal(state.updatedAt, fixedTimestamp)
    assert.equal(state.schemaVersion, 1)
  } finally {
    Date.now = originalDateNow
  }
})

test('initializeMatchState computes setsNeededToWin using ceiling division', () => {
  const oneSetState = initializeMatchState(1)
  const threeSetState = initializeMatchState(3)
  const fiveSetState = initializeMatchState(5)

  assert.equal(oneSetState.setsNeededToWin, SETS_NEEDED_TO_WIN.ONE)
  assert.equal(threeSetState.setsNeededToWin, SETS_NEEDED_TO_WIN.TWO)
  assert.equal(fiveSetState.setsNeededToWin, SETS_NEEDED_TO_WIN.THREE)
})

test('initializeMatchState returns independent state objects for each call', () => {
  const firstState = initializeMatchState(3)
  const secondState = initializeMatchState(3)

  firstState.setsWon.teamA = 1
  firstState.currentSet.games.teamA = 3
  firstState.currentGame.points.teamA = 15

  assert.equal(secondState.setsWon.teamA, 0)
  assert.equal(secondState.currentSet.games.teamA, 0)
  assert.equal(secondState.currentGame.points.teamA, 0)

  assert.notEqual(firstState, secondState)
  assert.notEqual(firstState.setsWon, secondState.setsWon)
  assert.notEqual(firstState.currentSet, secondState.currentSet)
  assert.notEqual(firstState.currentGame, secondState.currentGame)
  assert.notEqual(firstState.setHistory, secondState.setHistory)
})

test('initializeMatchState throws TypeError for invalid setsToPlay values', () => {
  const invalidValues = [0, 2, 4, 6, -1, 1.5, 3.5, null, undefined, '1', '3', {}, [], true, false]

  for (const invalidValue of invalidValues) {
    assert.throws(
      () => initializeMatchState(invalidValue),
      {
        name: 'TypeError',
        message: 'setsToPlay must be one of: 1, 3, 5'
      },
      `Expected TypeError for value: ${JSON.stringify(invalidValue)}`
    )
  }
})

test('initializeMatchState throws TypeError with descriptive message for non-integer input', () => {
  assert.throws(
    () => initializeMatchState(2),
    {
      name: 'TypeError',
      message: 'setsToPlay must be one of: 1, 3, 5'
    }
  )
})

test('initializeMatchState throws TypeError for string input even if numeric', () => {
  assert.throws(
    () => initializeMatchState('3'),
    {
      name: 'TypeError',
      message: 'setsToPlay must be one of: 1, 3, 5'
    }
  )
})

test('initializeMatchState throws TypeError for null input', () => {
  assert.throws(
    () => initializeMatchState(null),
    {
      name: 'TypeError',
      message: 'setsToPlay must be one of: 1, 3, 5'
    }
  )
})

test('initializeMatchState throws TypeError for undefined input', () => {
  assert.throws(
    () => initializeMatchState(undefined),
    {
      name: 'TypeError',
      message: 'setsToPlay must be one of: 1, 3, 5'
    }
  )
})

test('initializeMatchState produces schema-valid match state for all supported set counts', async (t) => {
  const { isMatchState } = await import('../utils/match-state-schema.js')

  for (const setsToPlay of SUPPORTED_SETS_TO_PLAY) {
    const state = initializeMatchState(setsToPlay)

    assert.equal(
      isMatchState(state),
      true,
      `initializeMatchState(${setsToPlay}) should produce schema-valid state`
    )
  }
})
