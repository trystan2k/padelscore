import { deepCopyState } from './history-stack.js'
import { SCORE_POINTS } from './scoring-constants.js'

const REGULAR_POINT_SEQUENCE = Object.freeze([
  SCORE_POINTS.LOVE,
  SCORE_POINTS.FIFTEEN,
  SCORE_POINTS.THIRTY,
  SCORE_POINTS.FORTY
])

const FORTY_POINT_INDEX = REGULAR_POINT_SEQUENCE.length - 1
const MIN_GAMES_TO_WIN_SET = 6
const MIN_GAME_MARGIN_TO_WIN_SET = 2
const TIE_BREAK_ENTRY_GAMES = 6
const MIN_TIE_BREAK_POINTS_TO_WIN_SET = 7
const MIN_TIE_BREAK_POINT_MARGIN = 2

/**
 * @param {'teamA' | 'teamB'} team
 * @returns {'teamA' | 'teamB'}
 */
function getOpponentTeam(team) {
  return team === 'teamA' ? 'teamB' : 'teamA'
}

/**
 * @param {unknown} team
 */
function assertValidTeam(team) {
  if (team !== 'teamA' && team !== 'teamB') {
    throw new TypeError("addPoint only accepts 'teamA' or 'teamB'.")
  }
}

/**
 * @param {unknown} points
 * @returns {number}
 */
function getRegularPointIndex(points) {
  return REGULAR_POINT_SEQUENCE.indexOf(points)
}

/**
 * @param {import('./match-state.js').MatchState} state
 */
function resetPoints(state) {
  state.teamA.points = SCORE_POINTS.LOVE
  state.teamB.points = SCORE_POINTS.LOVE
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} team
 */
function incrementGameCounter(state, team) {
  state[team].games += 1

  if (team === 'teamA') {
    state.currentSetStatus.teamAGames += 1
    return
  }

  state.currentSetStatus.teamBGames += 1
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} team
 * @returns {number}
 */
function getSetGames(state, team) {
  return team === 'teamA'
    ? state.currentSetStatus.teamAGames
    : state.currentSetStatus.teamBGames
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} team
 * @returns {boolean}
 */
function isSetWon(state, team) {
  const opponentTeam = getOpponentTeam(team)
  const scoringTeamGames = getSetGames(state, team)
  const opponentTeamGames = getSetGames(state, opponentTeam)

  return (
    scoringTeamGames >= MIN_GAMES_TO_WIN_SET &&
    scoringTeamGames - opponentTeamGames >= MIN_GAME_MARGIN_TO_WIN_SET
  )
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @returns {boolean}
 */
function isTieBreakMode(state) {
  return (
    state.currentSetStatus.teamAGames === TIE_BREAK_ENTRY_GAMES &&
    state.currentSetStatus.teamBGames === TIE_BREAK_ENTRY_GAMES
  )
}

/**
 * @param {unknown} points
 * @returns {number}
 */
function getTieBreakPoints(points) {
  return Number.isInteger(points) && points >= 0 ? points : 0
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} team
 * @returns {boolean}
 */
function isTieBreakWon(state, team) {
  const opponentTeam = getOpponentTeam(team)
  const scoringTeamPoints = getTieBreakPoints(state[team].points)
  const opponentPoints = getTieBreakPoints(state[opponentTeam].points)

  return (
    scoringTeamPoints >= MIN_TIE_BREAK_POINTS_TO_WIN_SET &&
    scoringTeamPoints - opponentPoints >= MIN_TIE_BREAK_POINT_MARGIN
  )
}

/**
 * @param {import('./match-state.js').MatchState} state
 */
function moveToNextSet(state) {
  state.currentSetStatus.number += 1
  state.currentSet = state.currentSetStatus.number

  state.teamA.games = 0
  state.teamB.games = 0
  state.currentSetStatus.teamAGames = 0
  state.currentSetStatus.teamBGames = 0
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} team
 */
function finalizeTieBreakWin(state, team) {
  incrementGameCounter(state, team)
  resetPoints(state)
  moveToNextSet(state)
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} team
 */
function handleTieBreakPoint(state, team) {
  const opponentTeam = getOpponentTeam(team)
  const scoringTeamPoints = getTieBreakPoints(state[team].points)

  state[team].points = scoringTeamPoints + 1
  state[opponentTeam].points = getTieBreakPoints(state[opponentTeam].points)

  if (isTieBreakWon(state, team)) {
    finalizeTieBreakWin(state, team)
  }
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} team
 */
function finalizeGameWin(state, team) {
  incrementGameCounter(state, team)
  resetPoints(state)

  if (isSetWon(state, team)) {
    moveToNextSet(state)
  }
}

/**
 * @param {unknown} historyStack
 */
function assertValidHistoryStack(historyStack) {
  if (!historyStack || typeof historyStack.push !== 'function') {
    throw new TypeError('addPoint historyStack must expose a push(state) method.')
  }
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {import('./history-stack.js').HistoryStack<import('./match-state.js').MatchState>} [historyStack]
 * @returns {import('./match-state.js').MatchState}
 */
function createNextState(state, historyStack) {
  const preUpdateSnapshot = deepCopyState(state)

  if (historyStack !== undefined) {
    assertValidHistoryStack(historyStack)
    historyStack.push(preUpdateSnapshot)
  }

  return deepCopyState(preUpdateSnapshot)
}

/**
 * Handles regular scoring, deuce/advantage transitions, and tie-break mode.
 *
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} team
 * @param {import('./history-stack.js').HistoryStack<import('./match-state.js').MatchState>} [historyStack]
 * @returns {import('./match-state.js').MatchState}
 */
export function addPoint(state, team, historyStack) {
  assertValidTeam(team)

  const nextState = createNextState(state, historyStack)

  if (isTieBreakMode(nextState)) {
    handleTieBreakPoint(nextState, team)
    return nextState
  }

  const opponentTeam = getOpponentTeam(team)
  const scoringTeamPoints = nextState[team].points
  const opponentTeamPoints = nextState[opponentTeam].points
  const scoringTeamPointIndex = getRegularPointIndex(nextState[team].points)
  const opponentPointIndex = getRegularPointIndex(nextState[opponentTeam].points)

  if (scoringTeamPoints === SCORE_POINTS.ADVANTAGE) {
    finalizeGameWin(nextState, team)
    return nextState
  }

  if (opponentTeamPoints === SCORE_POINTS.ADVANTAGE) {
    nextState[team].points = SCORE_POINTS.FORTY
    nextState[opponentTeam].points = SCORE_POINTS.FORTY
    return nextState
  }

  if (
    scoringTeamPoints === SCORE_POINTS.FORTY &&
    opponentTeamPoints === SCORE_POINTS.FORTY
  ) {
    nextState[team].points = SCORE_POINTS.ADVANTAGE
    return nextState
  }

  if (
    scoringTeamPointIndex === FORTY_POINT_INDEX &&
    opponentPointIndex > -1 &&
    opponentPointIndex < FORTY_POINT_INDEX
  ) {
    finalizeGameWin(nextState, team)
    return nextState
  }

  if (scoringTeamPointIndex > -1 && scoringTeamPointIndex < FORTY_POINT_INDEX) {
    nextState[team].points = REGULAR_POINT_SEQUENCE[scoringTeamPointIndex + 1]
  }

  return nextState
}
