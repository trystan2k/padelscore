import {
  createDefaultMatchState,
  MATCH_STATUS,
  SETS_TO_PLAY,
  toIsoTimestampSafe
} from './match-state-schema.js'

export const SUPPORTED_SETS_TO_PLAY = Object.freeze([
  SETS_TO_PLAY.ONE,
  SETS_TO_PLAY.THREE,
  SETS_TO_PLAY.FIVE
])

const supportedSetsToPlaySet = new Set(SUPPORTED_SETS_TO_PLAY)

/**
 * @param {unknown} setsToPlay
 * @returns {setsToPlay is import('./match-state-schema.js').SetsToPlay}
 */
export function isSupportedSetsToPlay(setsToPlay) {
  return supportedSetsToPlaySet.has(setsToPlay)
}

/**
 * @param {import('./match-state-schema.js').SetsToPlay} setsToPlay
 * @returns {import('./match-state-schema.js').MatchState}
 */
export function initializeMatchState(setsToPlay) {
  if (!isSupportedSetsToPlay(setsToPlay)) {
    throw new TypeError('setsToPlay must be one of: 1, 3, 5')
  }

  const matchState = createDefaultMatchState()
  const updatedAt = Date.now()
  const updatedAtIso = toIsoTimestampSafe(updatedAt)
  const setsNeededToWin = Math.ceil(setsToPlay / 2)
  const canonicalSetsWon = {
    teamA: 0,
    teamB: 0
  }
  const canonicalCurrentSet = {
    number: 1,
    games: {
      teamA: 0,
      teamB: 0
    }
  }
  const canonicalCurrentGame = {
    points: {
      teamA: 0,
      teamB: 0
    }
  }

  const mirroredSetsWon = {
    teamA: canonicalSetsWon.teamA,
    teamB: canonicalSetsWon.teamB
  }
  const mirroredCurrentSet = {
    number: canonicalCurrentSet.number,
    games: {
      teamA: canonicalCurrentSet.games.teamA,
      teamB: canonicalCurrentSet.games.teamB
    }
  }
  const mirroredCurrentGame = {
    points: {
      teamA: canonicalCurrentGame.points.teamA,
      teamB: canonicalCurrentGame.points.teamB
    }
  }

  return {
    ...matchState,
    status: MATCH_STATUS.ACTIVE,
    setsToPlay,
    setsNeededToWin,
    setsWon: mirroredSetsWon,
    currentSet: mirroredCurrentSet,
    currentGame: mirroredCurrentGame,
    settings: {
      setsToPlay,
      setsNeededToWin
    },
    scores: {
      setsWon: canonicalSetsWon,
      currentSet: canonicalCurrentSet,
      currentGame: canonicalCurrentGame
    },
    timing: {
      ...matchState.timing,
      updatedAt: updatedAtIso,
      startedAt: matchState.timing.startedAt ?? updatedAtIso,
      finishedAt: null
    },
    setHistory: [],
    updatedAt
  }
}
