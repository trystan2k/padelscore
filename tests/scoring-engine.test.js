import assert from 'node:assert/strict'
import test from 'node:test'

import { createInitialMatchState } from '../utils/match-state.js'
import { addPoint, removePoint } from '../utils/scoring-engine.js'
import { SCORE_POINTS } from '../utils/scoring-constants.js'
import { createHistoryStack } from '../utils/history-stack.js'

const VALID_REGULAR_POINTS = new Set([
  SCORE_POINTS.LOVE,
  SCORE_POINTS.FIFTEEN,
  SCORE_POINTS.THIRTY,
  SCORE_POINTS.FORTY,
  SCORE_POINTS.ADVANTAGE
])

function assertValidUndoState(state) {
  const points = [state.teamA.points, state.teamB.points]

  points.forEach((point) => {
    const isValidNumericTieBreakPoint = Number.isInteger(point) && point >= 0
    const isValidRegularPoint = VALID_REGULAR_POINTS.has(point)
    assert.equal(
      isValidRegularPoint || isValidNumericTieBreakPoint,
      true,
      'undo should keep point values in a valid scoring domain'
    )
  })

  assert.equal(Number.isInteger(state.teamA.games) && state.teamA.games >= 0, true)
  assert.equal(Number.isInteger(state.teamB.games) && state.teamB.games >= 0, true)
  assert.equal(
    Number.isInteger(state.currentSetStatus.teamAGames) && state.currentSetStatus.teamAGames >= 0,
    true
  )
  assert.equal(
    Number.isInteger(state.currentSetStatus.teamBGames) && state.currentSetStatus.teamBGames >= 0,
    true
  )
  assert.equal(Number.isInteger(state.currentSetStatus.number) && state.currentSetStatus.number >= 1, true)
  assert.equal(Number.isInteger(state.currentSet) && state.currentSet >= 1, true)
}

function createStateWithTeamAGamePoint(teamAGames, teamBGames) {
  const state = createInitialMatchState()
  state.teamA.games = teamAGames
  state.teamB.games = teamBGames
  state.currentSetStatus.teamAGames = teamAGames
  state.currentSetStatus.teamBGames = teamBGames
  state.teamA.points = SCORE_POINTS.FORTY
  state.teamB.points = SCORE_POINTS.LOVE
  return state
}

function createTieBreakState(teamAPoints = 0, teamBPoints = 0) {
  const state = createInitialMatchState()
  state.teamA.games = 6
  state.teamB.games = 6
  state.currentSetStatus.teamAGames = 6
  state.currentSetStatus.teamBGames = 6
  state.teamA.points = teamAPoints
  state.teamB.points = teamBPoints
  return state
}

function createSetPointState({
  winningTeam,
  setsNeededToWin,
  setsWonByWinningTeam,
  currentSetNumber = 1,
  teamAGames = 5,
  teamBGames = 0
}) {
  const state = createInitialMatchState()
  const losingTeam = winningTeam === 'teamA' ? 'teamB' : 'teamA'

  state.setsNeededToWin = setsNeededToWin
  state.setsWon = {
    teamA: winningTeam === 'teamA' ? setsWonByWinningTeam : 0,
    teamB: winningTeam === 'teamB' ? setsWonByWinningTeam : 0
  }
  state.currentSetStatus.number = currentSetNumber
  state.currentSet = currentSetNumber
  state.currentSetStatus.teamAGames = teamAGames
  state.currentSetStatus.teamBGames = teamBGames
  state.teamA.games = teamAGames
  state.teamB.games = teamBGames
  state[winningTeam].points = SCORE_POINTS.FORTY
  state[losingTeam].points = SCORE_POINTS.LOVE

  return state
}

test('addPoint progresses regular points from 0 to 40', () => {
  const initialState = createInitialMatchState()

  const afterFifteen = addPoint(initialState, 'teamA')
  const afterThirty = addPoint(afterFifteen, 'teamA')
  const afterForty = addPoint(afterThirty, 'teamA')

  assert.equal(afterFifteen.teamA.points, SCORE_POINTS.FIFTEEN)
  assert.equal(afterThirty.teamA.points, SCORE_POINTS.THIRTY)
  assert.equal(afterForty.teamA.points, SCORE_POINTS.FORTY)
  assert.equal(afterForty.teamA.games, 0)
  assert.equal(afterForty.currentSetStatus.teamAGames, 0)
})

test('addPoint awards a game and resets points when opponent is below 40', () => {
  const opponentPointScenarios = [
    SCORE_POINTS.LOVE,
    SCORE_POINTS.FIFTEEN,
    SCORE_POINTS.THIRTY
  ]

  opponentPointScenarios.forEach((opponentPoints) => {
    const state = createInitialMatchState()
    state.teamA.points = SCORE_POINTS.FORTY
    state.teamB.points = opponentPoints

    const nextState = addPoint(state, 'teamA')

    assert.equal(nextState.teamA.games, 1)
    assert.equal(nextState.currentSetStatus.teamAGames, 1)
    assert.equal(nextState.teamB.games, 0)
    assert.equal(nextState.currentSetStatus.teamBGames, 0)
    assert.equal(nextState.teamA.points, SCORE_POINTS.LOVE)
    assert.equal(nextState.teamB.points, SCORE_POINTS.LOVE)
  })
})

test('addPoint enters deuce when trailing team reaches 40', () => {
  const state = createInitialMatchState()
  state.teamA.points = SCORE_POINTS.FORTY
  state.teamB.points = SCORE_POINTS.THIRTY

  const nextState = addPoint(state, 'teamB')

  assert.equal(nextState.teamA.points, SCORE_POINTS.FORTY)
  assert.equal(nextState.teamB.points, SCORE_POINTS.FORTY)
  assert.equal(nextState.teamA.games, 0)
  assert.equal(nextState.teamB.games, 0)
})

test('addPoint grants advantage from deuce', () => {
  const state = createInitialMatchState()
  state.teamA.points = SCORE_POINTS.FORTY
  state.teamB.points = SCORE_POINTS.FORTY

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.teamA.points, SCORE_POINTS.ADVANTAGE)
  assert.equal(nextState.teamB.points, SCORE_POINTS.FORTY)
  assert.equal(nextState.teamA.games, 0)
  assert.equal(nextState.teamB.games, 0)
})

test('addPoint returns to deuce when team with advantage loses point', () => {
  const state = createInitialMatchState()
  state.teamA.points = SCORE_POINTS.ADVANTAGE
  state.teamB.points = SCORE_POINTS.FORTY

  const nextState = addPoint(state, 'teamB')

  assert.equal(nextState.teamA.points, SCORE_POINTS.FORTY)
  assert.equal(nextState.teamB.points, SCORE_POINTS.FORTY)
  assert.equal(nextState.teamA.games, 0)
  assert.equal(nextState.teamB.games, 0)
})

test('addPoint awards game when team with advantage scores again', () => {
  const state = createInitialMatchState()
  state.teamA.points = SCORE_POINTS.ADVANTAGE
  state.teamB.points = SCORE_POINTS.FORTY

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.teamA.games, 1)
  assert.equal(nextState.currentSetStatus.teamAGames, 1)
  assert.equal(nextState.teamB.games, 0)
  assert.equal(nextState.currentSetStatus.teamBGames, 0)
  assert.equal(nextState.teamA.points, SCORE_POINTS.LOVE)
  assert.equal(nextState.teamB.points, SCORE_POINTS.LOVE)
})

test('addPoint wins set at 6-0 and resets games for next set', () => {
  const state = createStateWithTeamAGamePoint(5, 0)

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.currentSetStatus.number, 2)
  assert.equal(nextState.currentSet, 2)
  assert.equal(nextState.teamA.games, 0)
  assert.equal(nextState.teamB.games, 0)
  assert.equal(nextState.currentSetStatus.teamAGames, 0)
  assert.equal(nextState.currentSetStatus.teamBGames, 0)
  assert.equal(nextState.teamA.points, SCORE_POINTS.LOVE)
  assert.equal(nextState.teamB.points, SCORE_POINTS.LOVE)
  assert.deepEqual(nextState.setsWon, {
    teamA: 1,
    teamB: 0
  })
  assert.deepEqual(nextState.setHistory, [
    {
      setNumber: 1,
      teamAGames: 6,
      teamBGames: 0
    }
  ])
  assert.equal(nextState.status, 'active')
})

test('addPoint wins set at 6-4 and resets games for next set', () => {
  const state = createStateWithTeamAGamePoint(5, 4)

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.currentSetStatus.number, 2)
  assert.equal(nextState.currentSet, 2)
  assert.equal(nextState.teamA.games, 0)
  assert.equal(nextState.teamB.games, 0)
  assert.equal(nextState.currentSetStatus.teamAGames, 0)
  assert.equal(nextState.currentSetStatus.teamBGames, 0)
})

test('addPoint does not end the set at 6-5', () => {
  const state = createStateWithTeamAGamePoint(5, 5)

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.currentSetStatus.number, 1)
  assert.equal(nextState.currentSet, 1)
  assert.equal(nextState.teamA.games, 6)
  assert.equal(nextState.teamB.games, 5)
  assert.equal(nextState.currentSetStatus.teamAGames, 6)
  assert.equal(nextState.currentSetStatus.teamBGames, 5)
  assert.equal(nextState.teamA.points, SCORE_POINTS.LOVE)
  assert.equal(nextState.teamB.points, SCORE_POINTS.LOVE)
})

test('addPoint wins set at 7-5 and resets games for next set', () => {
  const state = createStateWithTeamAGamePoint(6, 5)

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.currentSetStatus.number, 2)
  assert.equal(nextState.currentSet, 2)
  assert.equal(nextState.teamA.games, 0)
  assert.equal(nextState.teamB.games, 0)
  assert.equal(nextState.currentSetStatus.teamAGames, 0)
  assert.equal(nextState.currentSetStatus.teamBGames, 0)
  assert.equal(nextState.teamA.points, SCORE_POINTS.LOVE)
  assert.equal(nextState.teamB.points, SCORE_POINTS.LOVE)
})

test('addPoint enters tie-break mode at 6-6 and counts points numerically', () => {
  const preTieBreakState = createStateWithTeamAGamePoint(5, 6)

  const tieBreakState = addPoint(preTieBreakState, 'teamA')
  const afterTieBreakPoint = addPoint(tieBreakState, 'teamA')

  assert.equal(tieBreakState.currentSetStatus.number, 1)
  assert.equal(tieBreakState.currentSet, 1)
  assert.equal(tieBreakState.teamA.games, 6)
  assert.equal(tieBreakState.teamB.games, 6)
  assert.equal(tieBreakState.currentSetStatus.teamAGames, 6)
  assert.equal(tieBreakState.currentSetStatus.teamBGames, 6)
  assert.equal(tieBreakState.teamA.points, SCORE_POINTS.LOVE)
  assert.equal(tieBreakState.teamB.points, SCORE_POINTS.LOVE)

  assert.equal(afterTieBreakPoint.teamA.points, 1)
  assert.equal(afterTieBreakPoint.teamB.points, 0)
  assert.equal(afterTieBreakPoint.teamA.games, 6)
  assert.equal(afterTieBreakPoint.teamB.games, 6)
})

test('addPoint wins tie-break set at 7-0 and resets for the next set', () => {
  let state = createTieBreakState()

  for (let point = 0; point < 7; point += 1) {
    state = addPoint(state, 'teamA')
  }

  assert.equal(state.currentSetStatus.number, 2)
  assert.equal(state.currentSet, 2)
  assert.equal(state.teamA.games, 0)
  assert.equal(state.teamB.games, 0)
  assert.equal(state.currentSetStatus.teamAGames, 0)
  assert.equal(state.currentSetStatus.teamBGames, 0)
  assert.equal(state.teamA.points, SCORE_POINTS.LOVE)
  assert.equal(state.teamB.points, SCORE_POINTS.LOVE)
})

test('addPoint wins tie-break set at 7-5', () => {
  const state = createTieBreakState(6, 5)

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.currentSetStatus.number, 2)
  assert.equal(nextState.currentSet, 2)
  assert.equal(nextState.teamA.games, 0)
  assert.equal(nextState.teamB.games, 0)
  assert.equal(nextState.currentSetStatus.teamAGames, 0)
  assert.equal(nextState.currentSetStatus.teamBGames, 0)
  assert.equal(nextState.teamA.points, SCORE_POINTS.LOVE)
  assert.equal(nextState.teamB.points, SCORE_POINTS.LOVE)
})

test('addPoint keeps set history unchanged when game is not won', () => {
  const state = createInitialMatchState()
  state.setHistory = [
    {
      setNumber: 1,
      teamAGames: 6,
      teamBGames: 4
    }
  ]

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.teamA.points, SCORE_POINTS.FIFTEEN)
  assert.deepEqual(nextState.setHistory, [
    {
      setNumber: 1,
      teamAGames: 6,
      teamBGames: 4
    }
  ])
})

test('addPoint marks match finished exactly when setsNeededToWin is 1', () => {
  const state = createSetPointState({
    winningTeam: 'teamA',
    setsNeededToWin: 1,
    setsWonByWinningTeam: 0,
    currentSetNumber: 1,
    teamAGames: 5,
    teamBGames: 0
  })

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.status, 'finished')
  assert.equal(nextState.winnerTeam, 'teamA')
  assert.equal(nextState.currentSetStatus.number, 1)
  assert.equal(nextState.currentSet, 1)
  assert.equal(nextState.setsWon.teamA, 1)
  assert.deepEqual(nextState.setHistory, [
    {
      setNumber: 1,
      teamAGames: 6,
      teamBGames: 0
    }
  ])
})

test('addPoint marks match finished exactly when setsNeededToWin is 2', () => {
  const state = createSetPointState({
    winningTeam: 'teamA',
    setsNeededToWin: 2,
    setsWonByWinningTeam: 1,
    currentSetNumber: 2,
    teamAGames: 5,
    teamBGames: 3
  })

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.status, 'finished')
  assert.equal(nextState.winnerTeam, 'teamA')
  assert.equal(nextState.currentSetStatus.number, 2)
  assert.equal(nextState.currentSet, 2)
  assert.equal(nextState.setsWon.teamA, 2)
  assert.equal(nextState.currentSetStatus.teamAGames, 0)
  assert.equal(nextState.currentSetStatus.teamBGames, 0)
})

test('addPoint marks match finished exactly when setsNeededToWin is 3', () => {
  const state = createSetPointState({
    winningTeam: 'teamA',
    setsNeededToWin: 3,
    setsWonByWinningTeam: 2,
    currentSetNumber: 5,
    teamAGames: 5,
    teamBGames: 4
  })

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.status, 'finished')
  assert.equal(nextState.winnerTeam, 'teamA')
  assert.equal(nextState.currentSetStatus.number, 5)
  assert.equal(nextState.currentSet, 5)
  assert.equal(nextState.setsWon.teamA, 3)
  assert.deepEqual(nextState.setHistory, [
    {
      setNumber: 5,
      teamAGames: 6,
      teamBGames: 4
    }
  ])
})

test('addPoint records tie-break set history as 7-6 and finishes when threshold reached', () => {
  const state = createTieBreakState(6, 5)
  state.setsNeededToWin = 1
  state.setsWon = {
    teamA: 0,
    teamB: 0
  }

  const nextState = addPoint(state, 'teamA')

  assert.equal(nextState.status, 'finished')
  assert.equal(nextState.winnerTeam, 'teamA')
  assert.equal(nextState.setsWon.teamA, 1)
  assert.deepEqual(nextState.setHistory, [
    {
      setNumber: 1,
      teamAGames: 7,
      teamBGames: 6
    }
  ])
  assert.equal(nextState.currentSetStatus.teamAGames, 0)
  assert.equal(nextState.currentSetStatus.teamBGames, 0)
})

test('addPoint wins tie-break set at 8-6 and requires a two-point margin', () => {
  const state = createTieBreakState(6, 6)

  const afterSevenSix = addPoint(state, 'teamA')
  const afterEightSix = addPoint(afterSevenSix, 'teamA')

  assert.equal(afterSevenSix.currentSetStatus.number, 1)
  assert.equal(afterSevenSix.currentSet, 1)
  assert.equal(afterSevenSix.teamA.points, 7)
  assert.equal(afterSevenSix.teamB.points, 6)
  assert.equal(afterSevenSix.teamA.games, 6)
  assert.equal(afterSevenSix.teamB.games, 6)

  assert.equal(afterEightSix.currentSetStatus.number, 2)
  assert.equal(afterEightSix.currentSet, 2)
  assert.equal(afterEightSix.teamA.games, 0)
  assert.equal(afterEightSix.teamB.games, 0)
  assert.equal(afterEightSix.currentSetStatus.teamAGames, 0)
  assert.equal(afterEightSix.currentSetStatus.teamBGames, 0)
  assert.equal(afterEightSix.teamA.points, SCORE_POINTS.LOVE)
  assert.equal(afterEightSix.teamB.points, SCORE_POINTS.LOVE)
})

test('addPoint increments history by one snapshot per scored point', () => {
  const history = createHistoryStack()
  let state = createInitialMatchState()

  assert.equal(history.size(), 0)

  state = addPoint(state, 'teamA', history)
  assert.equal(history.size(), 1)

  state = addPoint(state, 'teamB', history)
  assert.equal(history.size(), 2)

  state = addPoint(state, 'teamA', history)
  assert.equal(history.size(), 3)

  assert.equal(state.teamA.points, SCORE_POINTS.THIRTY)
  assert.equal(state.teamB.points, SCORE_POINTS.FIFTEEN)
})

test('addPoint stores deep-copied pre-update snapshot that restores prior state', () => {
  const history = createHistoryStack()
  const initialState = createInitialMatchState()

  const afterFirstPoint = addPoint(initialState, 'teamA', history)
  const afterSecondPoint = addPoint(afterFirstPoint, 'teamA', history)
  const restoredPreviousState = history.pop()

  assert.deepEqual(restoredPreviousState, afterFirstPoint)

  afterSecondPoint.teamA.points = SCORE_POINTS.FORTY
  afterSecondPoint.currentSetStatus.teamAGames = 99
  afterSecondPoint.teams.teamA.label = 'Modified Team A'

  assert.deepEqual(restoredPreviousState, afterFirstPoint)
  assert.equal(restoredPreviousState.teamA.points, SCORE_POINTS.FIFTEEN)
  assert.equal(restoredPreviousState.currentSetStatus.teamAGames, 0)
  assert.equal(restoredPreviousState.teams.teamA.label, 'Team A')
})

test('removePoint undoes a single scored point', () => {
  const history = createHistoryStack()
  const initialState = createInitialMatchState()

  const afterPoint = addPoint(initialState, 'teamA', history)
  const restoredState = removePoint(afterPoint, history)

  assert.equal(afterPoint.teamA.points, SCORE_POINTS.FIFTEEN)
  assert.deepEqual(restoredState, initialState)
  assert.equal(history.size(), 0)
})

test('removePoint handles rapid repeated undos back to initial state', () => {
  const history = createHistoryStack()
  let state = createInitialMatchState()

  state = addPoint(state, 'teamA', history)
  state = addPoint(state, 'teamB', history)
  state = addPoint(state, 'teamA', history)
  state = addPoint(state, 'teamA', history)
  state = addPoint(state, 'teamB', history)

  const undoAttempts = history.size() + 5

  for (let index = 0; index < undoAttempts; index += 1) {
    state = removePoint(state, history)
    assertValidUndoState(state)
  }

  assert.deepEqual(state, createInitialMatchState())
  assert.equal(history.size(), 0)
})

test('removePoint is a no-op when history is empty', () => {
  const state = addPoint(createInitialMatchState(), 'teamA')
  const history = createHistoryStack()

  const restoredState = removePoint(state, history)

  assert.deepEqual(restoredState, state)
  assert.equal(history.size(), 0)
})

test('removePoint is a no-op when already at initial state', () => {
  const state = createInitialMatchState()
  const history = createHistoryStack()
  history.push(createInitialMatchState())

  const restoredState = removePoint(state, history)

  assert.deepEqual(restoredState, state)
  assert.equal(history.size(), 1)
})

test('removePoint restores pre-game-win snapshot exactly', () => {
  const history = createHistoryStack()
  const preGameWinState = createStateWithTeamAGamePoint(0, 0)

  const afterGameWinState = addPoint(preGameWinState, 'teamA', history)
  const restoredState = removePoint(afterGameWinState, history)

  assert.equal(afterGameWinState.teamA.games, 1)
  assert.equal(afterGameWinState.teamA.points, SCORE_POINTS.LOVE)
  assert.deepEqual(restoredState, preGameWinState)
})

test('removePoint restores pre-set-win snapshot exactly', () => {
  const history = createHistoryStack()
  const preSetWinState = createStateWithTeamAGamePoint(5, 4)

  const afterSetWinState = addPoint(preSetWinState, 'teamA', history)
  const restoredState = removePoint(afterSetWinState, history)

  assert.equal(afterSetWinState.currentSet, 2)
  assert.equal(afterSetWinState.currentSetStatus.number, 2)
  assert.deepEqual(restoredState, preSetWinState)
})

test('removePoint restores tie-break point progression snapshot', () => {
  const history = createHistoryStack()
  const preTieBreakPointState = createTieBreakState(3, 2)

  const afterTieBreakPointState = addPoint(preTieBreakPointState, 'teamA', history)
  const restoredState = removePoint(afterTieBreakPointState, history)

  assert.equal(afterTieBreakPointState.teamA.points, 4)
  assert.equal(afterTieBreakPointState.teamB.points, 2)
  assert.deepEqual(restoredState, preTieBreakPointState)
})

test('removePoint restores pre-tie-break-set-win snapshot', () => {
  const history = createHistoryStack()
  const preTieBreakSetWinState = createTieBreakState(6, 5)

  const afterTieBreakSetWinState = addPoint(preTieBreakSetWinState, 'teamA', history)
  const restoredState = removePoint(afterTieBreakSetWinState, history)

  assert.equal(afterTieBreakSetWinState.currentSetStatus.number, 2)
  assert.equal(afterTieBreakSetWinState.currentSet, 2)
  assert.deepEqual(restoredState, preTieBreakSetWinState)
})
