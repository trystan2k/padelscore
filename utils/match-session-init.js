import {
  MATCH_STATUS,
  SETS_TO_PLAY,
  createDefaultMatchState
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

  return {
    ...matchState,
    status: MATCH_STATUS.ACTIVE,
    setsToPlay,
    setsNeededToWin: Math.ceil(setsToPlay / 2),
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
        teamA: 0,
        teamB: 0
      }
    },
    setHistory: [],
    updatedAt: Date.now()
  }
}
