import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createManualFinishedMatchStateSnapshot,
  didMatchTransitionFromFinished,
  didMatchTransitionToFinished,
  removeLatestPointForTeamFromHistory
} from '../page/game/logic.js'
import { SCORE_POINTS } from '../utils/constants.js'
import { createHistoryStack } from '../utils/history-stack.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { MATCH_STATUS } from '../utils/match-state-schema.js'
import { addPoint } from '../utils/scoring-engine.js'

test('removeLatestPointForTeamFromHistory removes the latest point for selected team', () => {
  const history = createHistoryStack()
  let runtimeState = createInitialMatchState()

  runtimeState = addPoint(runtimeState, 'teamA', history)
  runtimeState = addPoint(runtimeState, 'teamB', history)
  runtimeState = addPoint(runtimeState, 'teamA', history)

  const removalResult = removeLatestPointForTeamFromHistory(
    runtimeState,
    history,
    'teamB'
  )

  assert.equal(removalResult?.didRemovePoint, true)
  assert.equal(removalResult?.runtimeState?.teamA?.points, SCORE_POINTS.THIRTY)
  assert.equal(removalResult?.runtimeState?.teamB?.points, SCORE_POINTS.LOVE)
  assert.equal(removalResult?.historyStack?.size(), 2)
})

test('removeLatestPointForTeamFromHistory keeps history when team has no score event', () => {
  const history = createHistoryStack()
  let runtimeState = createInitialMatchState()

  runtimeState = addPoint(runtimeState, 'teamA', history)
  runtimeState = addPoint(runtimeState, 'teamA', history)

  const originalState = runtimeState
  const originalHistorySize = history.size()

  const removalResult = removeLatestPointForTeamFromHistory(
    runtimeState,
    history,
    'teamB'
  )

  assert.equal(removalResult?.didRemovePoint, false)
  assert.equal(removalResult?.historyStack, history)
  assert.equal(removalResult?.historyStack?.size(), originalHistorySize)
  assert.deepEqual(removalResult?.runtimeState, originalState)
})

test('removeLatestPointForTeamFromHistory returns null for invalid inputs', () => {
  const history = createHistoryStack()
  const runtimeState = createInitialMatchState()

  const invalidTeamResult = removeLatestPointForTeamFromHistory(
    runtimeState,
    history,
    'teamC'
  )

  const invalidStateResult = removeLatestPointForTeamFromHistory(
    null,
    history,
    'teamA'
  )

  assert.equal(invalidTeamResult, null)
  assert.equal(invalidStateResult, null)
})

test('didMatchTransitionToFinished detects active-to-finished transitions', () => {
  assert.equal(
    didMatchTransitionToFinished(
      { status: MATCH_STATUS.ACTIVE },
      { status: MATCH_STATUS.FINISHED }
    ),
    true
  )
  assert.equal(
    didMatchTransitionToFinished(
      { status: MATCH_STATUS.FINISHED },
      { status: MATCH_STATUS.FINISHED }
    ),
    false
  )
  assert.equal(
    didMatchTransitionToFinished(null, { status: MATCH_STATUS.FINISHED }),
    false
  )
})

test('didMatchTransitionFromFinished detects finished-to-active transitions', () => {
  assert.equal(
    didMatchTransitionFromFinished(
      { status: MATCH_STATUS.FINISHED },
      { status: MATCH_STATUS.ACTIVE }
    ),
    true
  )
  assert.equal(
    didMatchTransitionFromFinished(
      { status: MATCH_STATUS.ACTIVE },
      { status: MATCH_STATUS.ACTIVE }
    ),
    false
  )
  assert.equal(
    didMatchTransitionFromFinished({ status: MATCH_STATUS.FINISHED }, null),
    false
  )
})

test('createManualFinishedMatchStateSnapshot returns a clone for already-finished states', () => {
  const finishedState = createInitialMatchState(1700000000)
  finishedState.status = MATCH_STATUS.FINISHED
  finishedState.setsWon = { teamA: 2, teamB: 0 }
  finishedState.setHistory = [{ setNumber: 1, teamAGames: 6, teamBGames: 2 }]
  finishedState.winnerTeam = 'teamA'
  finishedState.winner = { team: 'teamA' }

  const snapshot = createManualFinishedMatchStateSnapshot(finishedState)

  assert.notEqual(snapshot, finishedState)
  assert.deepEqual(snapshot, finishedState)
})

test('createManualFinishedMatchStateSnapshot sets winner metadata for teamA and teamB', () => {
  const teamAWinState = createInitialMatchState(1700000000)
  teamAWinState.setsWon = { teamA: 2, teamB: 1 }

  const teamAWinSnapshot = createManualFinishedMatchStateSnapshot(teamAWinState)

  assert.equal(teamAWinSnapshot?.status, MATCH_STATUS.FINISHED)
  assert.equal(teamAWinSnapshot?.winnerTeam, 'teamA')
  assert.equal(teamAWinSnapshot?.winner?.team, 'teamA')

  const teamBWinState = createInitialMatchState(1700000000)
  teamBWinState.currentSetStatus = {
    number: 3,
    teamAGames: 5,
    teamBGames: 6
  }
  teamBWinState.setsWon = { teamA: 1, teamB: 2 }

  const teamBWinSnapshot = createManualFinishedMatchStateSnapshot(teamBWinState)

  assert.equal(teamBWinSnapshot?.status, MATCH_STATUS.FINISHED)
  assert.equal(teamBWinSnapshot?.winnerTeam, 'teamB')
  assert.equal(teamBWinSnapshot?.winner?.team, 'teamB')
  assert.deepEqual(teamBWinSnapshot?.setHistory, [
    { setNumber: 3, teamAGames: 5, teamBGames: 6 }
  ])
})

test('createManualFinishedMatchStateSnapshot clears winner metadata for ties', () => {
  const tieState = createInitialMatchState(1700000000)
  tieState.setsWon = { teamA: 1, teamB: 1 }
  tieState.winnerTeam = 'teamA'
  tieState.winner = { team: 'teamA' }

  const tieSnapshot = createManualFinishedMatchStateSnapshot(tieState)

  assert.equal(tieSnapshot?.status, MATCH_STATUS.FINISHED)
  assert.equal(tieSnapshot?.winnerTeam, undefined)
  assert.equal(tieSnapshot?.winner, undefined)
})

test('createManualFinishedMatchStateSnapshot returns null for invalid states', () => {
  assert.equal(createManualFinishedMatchStateSnapshot(null), null)
})
