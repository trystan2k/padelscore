import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPersistedMatchStateSnapshot,
  isPersistedMatchStateActive,
  loadState,
  mergeRuntimeStateWithPersistedSession,
  saveState
} from '../page/game/persistence.js'
import {
  PERSISTED_ADVANTAGE_POINT_VALUE,
  PERSISTED_GAME_POINT_VALUE,
  SCORE_POINTS
} from '../utils/constants.js'
import { initializeMatchState } from '../utils/match-session-init.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { MATCH_STATUS } from '../utils/match-state-schema.js'
import {
  ACTIVE_MATCH_SESSION_STORAGE_KEY,
  matchStorage
} from '../utils/match-storage.js'

function createRuntimeState() {
  const runtimeState = createInitialMatchState(1700000000)
  runtimeState.status = MATCH_STATUS.ACTIVE
  runtimeState.setsNeededToWin = 2
  runtimeState.setsWon = { teamA: 0, teamB: 0 }
  runtimeState.setHistory = []
  return runtimeState
}

test('persistence maps regular-game runtime points to canonical and back', () => {
  const runtimeState = createRuntimeState()
  runtimeState.currentSetStatus = {
    number: 2,
    teamAGames: 4,
    teamBGames: 5
  }
  runtimeState.currentSet = 2
  runtimeState.teamA.games = 4
  runtimeState.teamB.games = 5
  runtimeState.teamA.points = SCORE_POINTS.ADVANTAGE
  runtimeState.teamB.points = SCORE_POINTS.GAME
  runtimeState.setsWon = { teamA: 1, teamB: 0 }
  runtimeState.setHistory = [{ setNumber: 1, teamAGames: 6, teamBGames: 4 }]

  const persistedSnapshot = createPersistedMatchStateSnapshot(
    runtimeState,
    initializeMatchState(3)
  )

  assert.notEqual(persistedSnapshot, null)
  assert.equal(isPersistedMatchStateActive(persistedSnapshot), true)
  assert.equal(
    persistedSnapshot?.currentGame?.points?.teamA,
    PERSISTED_ADVANTAGE_POINT_VALUE
  )
  assert.equal(
    persistedSnapshot?.currentGame?.points?.teamB,
    PERSISTED_GAME_POINT_VALUE
  )
  assert.equal(persistedSnapshot?.currentSet?.number, 2)
  assert.deepEqual(persistedSnapshot?.setsWon, { teamA: 1, teamB: 0 })

  const mergedRuntimeState = mergeRuntimeStateWithPersistedSession(
    createRuntimeState(),
    persistedSnapshot
  )

  assert.equal(mergedRuntimeState.status, MATCH_STATUS.ACTIVE)
  assert.equal(mergedRuntimeState.teamA.points, SCORE_POINTS.ADVANTAGE)
  assert.equal(mergedRuntimeState.teamB.points, SCORE_POINTS.GAME)
  assert.equal(mergedRuntimeState.currentSetStatus.number, 2)
  assert.equal(mergedRuntimeState.currentSetStatus.teamAGames, 4)
  assert.equal(mergedRuntimeState.currentSetStatus.teamBGames, 5)
})

test('mergeRuntimeStateWithPersistedSession keeps tie-break points numeric', () => {
  const persistedState = initializeMatchState(3)
  persistedState.currentSet = {
    number: 1,
    games: { teamA: 6, teamB: 6 }
  }
  persistedState.currentGame = {
    points: {
      teamA: PERSISTED_ADVANTAGE_POINT_VALUE,
      teamB: PERSISTED_GAME_POINT_VALUE
    }
  }

  const mergedRuntimeState = mergeRuntimeStateWithPersistedSession(
    createRuntimeState(),
    persistedState
  )

  assert.equal(mergedRuntimeState.teamA.points, PERSISTED_ADVANTAGE_POINT_VALUE)
  assert.equal(mergedRuntimeState.teamB.points, PERSISTED_GAME_POINT_VALUE)
})

test('mergeRuntimeStateWithPersistedSession keeps runtime session active and clears active winner metadata', () => {
  const finishedPersistedState = initializeMatchState(3)
  finishedPersistedState.status = MATCH_STATUS.FINISHED
  finishedPersistedState.winnerTeam = 'teamA'
  finishedPersistedState.winner = { team: 'teamA' }

  const mergedFromFinishedState = mergeRuntimeStateWithPersistedSession(
    createRuntimeState(),
    finishedPersistedState
  )

  assert.equal(mergedFromFinishedState.status, MATCH_STATUS.ACTIVE)
  assert.equal(mergedFromFinishedState.winnerTeam, undefined)
  assert.equal(mergedFromFinishedState.winner, undefined)

  const activeWithWinnerMetadata = initializeMatchState(3)
  activeWithWinnerMetadata.status = MATCH_STATUS.ACTIVE
  activeWithWinnerMetadata.winnerTeam = 'teamA'
  activeWithWinnerMetadata.winner = { team: 'teamA' }

  const mergedActiveState = mergeRuntimeStateWithPersistedSession(
    createRuntimeState(),
    activeWithWinnerMetadata
  )

  assert.equal(mergedActiveState.status, MATCH_STATUS.ACTIVE)
  assert.equal(mergedActiveState.winnerTeam, undefined)
  assert.equal(mergedActiveState.winner, undefined)
})

test('createPersistedMatchStateSnapshot propagates status and winner metadata parity from runtime state', () => {
  const finishedWithWinnerTeam = createRuntimeState()
  finishedWithWinnerTeam.status = MATCH_STATUS.FINISHED
  finishedWithWinnerTeam.setsWon = { teamA: 2, teamB: 0 }
  finishedWithWinnerTeam.winnerTeam = 'teamA'

  const finishedWinnerTeamSnapshot = createPersistedMatchStateSnapshot(
    finishedWithWinnerTeam,
    initializeMatchState(3)
  )

  assert.equal(finishedWinnerTeamSnapshot?.status, MATCH_STATUS.FINISHED)
  assert.equal(finishedWinnerTeamSnapshot?.winnerTeam, 'teamA')

  const finishedWithWinnerObject = createRuntimeState()
  finishedWithWinnerObject.status = MATCH_STATUS.FINISHED
  finishedWithWinnerObject.setsWon = { teamA: 0, teamB: 2 }
  finishedWithWinnerObject.winner = { team: 'teamB' }

  const finishedWinnerObjectSnapshot = createPersistedMatchStateSnapshot(
    finishedWithWinnerObject,
    initializeMatchState(3)
  )

  assert.equal(finishedWinnerObjectSnapshot?.status, MATCH_STATUS.FINISHED)
  assert.equal(finishedWinnerObjectSnapshot?.winnerTeam, 'teamB')

  const activeRuntimeState = createRuntimeState()
  activeRuntimeState.status = MATCH_STATUS.ACTIVE

  const activeSnapshot = createPersistedMatchStateSnapshot(
    activeRuntimeState,
    initializeMatchState(3)
  )

  assert.equal(activeSnapshot?.status, MATCH_STATUS.ACTIVE)
  assert.equal('winnerTeam' in (activeSnapshot ?? {}), false)
})

test('persistence helpers handle invalid input safely', () => {
  const invalidSnapshot = createPersistedMatchStateSnapshot(
    null,
    initializeMatchState(3)
  )
  const mergedFallback = mergeRuntimeStateWithPersistedSession(
    null,
    initializeMatchState(3)
  )

  assert.equal(invalidSnapshot, null)
  assert.deepEqual(mergedFallback, createInitialMatchState())
  assert.equal(isPersistedMatchStateActive(null), false)
  assert.equal(
    isPersistedMatchStateActive({ status: MATCH_STATUS.FINISHED }),
    false
  )
})

test('loadState/saveState delegate through unified active-session storage', () => {
  const originalAdapter = matchStorage.adapter
  const calls = []
  let savedPayload = null
  const persistedState = initializeMatchState(3)

  matchStorage.adapter = {
    save(key, value) {
      calls.push({ type: 'save', key })
      savedPayload = value
    },
    load(key) {
      calls.push({ type: 'load', key })
      return savedPayload
    },
    clear() {}
  }

  try {
    saveState(persistedState)
    const loadedState = loadState()

    assert.equal(calls.length, 2)
    assert.deepEqual(calls, [
      { type: 'save', key: ACTIVE_MATCH_SESSION_STORAGE_KEY },
      { type: 'load', key: ACTIVE_MATCH_SESSION_STORAGE_KEY }
    ])
    assert.equal(typeof savedPayload, 'string')
    assert.equal(loadedState?.status, MATCH_STATUS.ACTIVE)
    assert.equal(loadedState?.setsToPlay, 3)
  } finally {
    matchStorage.adapter = originalAdapter
  }
})
