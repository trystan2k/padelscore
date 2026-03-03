import { MATCH_SET_OPTIONS } from './constants.js'
import {
  createDefaultMatchState,
  MATCH_STATUS,
  toIsoTimestampSafe
} from './match-state-schema.js'
import { isSupportedSetsToPlay as isSupportedSetsToPlayValue } from './validation.js'

export const SUPPORTED_SETS_TO_PLAY = MATCH_SET_OPTIONS

/**
 * @param {unknown} setsToPlay
 * @returns {setsToPlay is import('./match-state-schema.js').SetsToPlay}
 */
export function isSupportedSetsToPlay(setsToPlay) {
  return isSupportedSetsToPlayValue(setsToPlay)
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
  const initializedAt =
    Number.isInteger(matchState.updatedAt) && matchState.updatedAt >= 0
      ? matchState.updatedAt
      : Date.now()
  const initializedAtIso = toIsoTimestampSafe(initializedAt)
  const startedAt =
    typeof matchState?.timing?.startedAt === 'string'
      ? matchState.timing.startedAt
      : initializedAtIso
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
      createdAt: matchState?.timing?.createdAt ?? startedAt,
      updatedAt: initializedAtIso,
      startedAt,
      finishedAt: null
    },
    setHistory: [],
    updatedAt: initializedAt
  }
}
