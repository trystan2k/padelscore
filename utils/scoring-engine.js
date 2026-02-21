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
const DEFAULT_SETS_NEEDED_TO_WIN = 2

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
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function toNonNegativeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function toPositiveInteger(value, fallback = 1) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

/**
 * @param {import('./match-state.js').MatchState} state
 */
function ensureSetTrackingMetadata(state) {
  state.setsNeededToWin = toPositiveInteger(
    state.setsNeededToWin,
    DEFAULT_SETS_NEEDED_TO_WIN
  )

  const setWins =
    state.setsWon && typeof state.setsWon === 'object'
      ? state.setsWon
      : { teamA: 0, teamB: 0 }

  state.setsWon = {
    teamA: toNonNegativeInteger(setWins.teamA, 0),
    teamB: toNonNegativeInteger(setWins.teamB, 0)
  }

  if (!Array.isArray(state.setHistory)) {
    state.setHistory = []
  }
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
function resetCurrentSetGames(state) {
  state.teamA.games = 0
  state.teamB.games = 0
  state.currentSetStatus.teamAGames = 0
  state.currentSetStatus.teamBGames = 0
}

/**
 * @param {import('./match-state.js').MatchState} state
 */
function moveToNextSet(state) {
  state.currentSetStatus.number += 1
  state.currentSet = state.currentSetStatus.number
  resetCurrentSetGames(state)
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} winningTeam
 */
function markMatchAsFinished(state, winningTeam) {
  state.status = 'finished'
  state.winnerTeam = winningTeam
  state.winner = {
    team: winningTeam,
    setNumber: state.currentSetStatus.number,
    setsWon: state.setsWon[winningTeam]
  }
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} team
 * @param {{ setCompletedByTieBreak?: boolean }} [options]
 */
function handleGameWin(state, team, options = {}) {
  const setCompletedByTieBreak = options.setCompletedByTieBreak === true

  ensureSetTrackingMetadata(state)
  incrementGameCounter(state, team)
  resetPoints(state)

  if (!setCompletedByTieBreak && !isSetWon(state, team)) {
    return
  }

  const completedSetNumber = toPositiveInteger(state.currentSetStatus.number, 1)
  const completedSetTeamAGames = toNonNegativeInteger(state.currentSetStatus.teamAGames, 0)
  const completedSetTeamBGames = toNonNegativeInteger(state.currentSetStatus.teamBGames, 0)

  state.setsWon[team] += 1
  state.setHistory.push({
    setNumber: completedSetNumber,
    teamAGames: completedSetTeamAGames,
    teamBGames: completedSetTeamBGames
  })

  resetCurrentSetGames(state)

  if (state.setsWon[team] >= state.setsNeededToWin) {
    markMatchAsFinished(state, team)
    return
  }

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
    handleGameWin(state, team, {
      setCompletedByTieBreak: true
    })
  }
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @param {'teamA' | 'teamB'} team
 */
function finalizeGameWin(state, team) {
  handleGameWin(state, team)
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
 * @param {unknown} historyStack
 */
function assertValidUndoHistoryStack(historyStack) {
  if (historyStack === undefined) {
    return
  }

  if (
    !historyStack ||
    typeof historyStack.pop !== 'function' ||
    typeof historyStack.isEmpty !== 'function'
  ) {
    throw new TypeError('removePoint historyStack must expose pop() and isEmpty() methods.')
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

/**
 * @param {unknown} points
 * @returns {boolean}
 */
function isValidPointValue(points) {
  return (
    points === SCORE_POINTS.LOVE ||
    points === SCORE_POINTS.FIFTEEN ||
    points === SCORE_POINTS.THIRTY ||
    points === SCORE_POINTS.FORTY ||
    points === SCORE_POINTS.ADVANTAGE ||
    isNonNegativeInteger(points)
  )
}

/**
 * @param {unknown} team
 * @returns {boolean}
 */
function isValidTeamState(team) {
  return (
    !!team &&
    typeof team === 'object' &&
    isValidPointValue(team.points) &&
    isNonNegativeInteger(team.games)
  )
}

/**
 * @param {unknown} currentSetStatus
 * @returns {boolean}
 */
function isValidCurrentSetStatus(currentSetStatus) {
  return (
    !!currentSetStatus &&
    typeof currentSetStatus === 'object' &&
    isNonNegativeInteger(currentSetStatus.teamAGames) &&
    isNonNegativeInteger(currentSetStatus.teamBGames) &&
    isNonNegativeInteger(currentSetStatus.number) &&
    currentSetStatus.number >= 1
  )
}

/**
 * @param {unknown} state
 * @returns {boolean}
 */
function isValidRestorableMatchState(state) {
  return (
    !!state &&
    typeof state === 'object' &&
    isValidTeamState(state.teamA) &&
    isValidTeamState(state.teamB) &&
    isValidCurrentSetStatus(state.currentSetStatus) &&
    isNonNegativeInteger(state.currentSet) &&
    state.currentSet >= 1 &&
    state.currentSet === state.currentSetStatus.number &&
    (state.status === 'active' || state.status === 'finished') &&
    isNonNegativeInteger(state.updatedAt)
  )
}

/**
 * @param {unknown} state
 */
function assertRestorableMatchState(state) {
  if (!isValidRestorableMatchState(state)) {
    throw new TypeError('removePoint can only restore a valid match snapshot state.')
  }
}

/**
 * @param {import('./match-state.js').MatchState} state
 * @returns {boolean}
 */
function isInitialLikeState(state) {
  return (
    state.teamA.points === SCORE_POINTS.LOVE &&
    state.teamB.points === SCORE_POINTS.LOVE &&
    state.teamA.games === 0 &&
    state.teamB.games === 0 &&
    state.currentSetStatus.number === 1 &&
    state.currentSetStatus.teamAGames === 0 &&
    state.currentSetStatus.teamBGames === 0 &&
    state.currentSet === 1
  )
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

  if (state.status === 'finished') {
    return deepCopyState(state)
  }

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

/**
 * Restores the previous match snapshot from history.
 *
 * @param {import('./match-state.js').MatchState} state
 * @param {import('./history-stack.js').HistoryStack<import('./match-state.js').MatchState>} [historyStack]
 * @returns {import('./match-state.js').MatchState}
 */
export function removePoint(state, historyStack) {
  assertValidUndoHistoryStack(historyStack)

  if (isInitialLikeState(state)) {
    return deepCopyState(state)
  }

  if (historyStack === undefined || historyStack.isEmpty()) {
    return deepCopyState(state)
  }

  const restoredState = historyStack.pop()

  if (restoredState === null) {
    return deepCopyState(state)
  }

  assertRestorableMatchState(restoredState)
  return deepCopyState(restoredState)
}
