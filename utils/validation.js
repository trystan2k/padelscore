import {
  DEFAULT_SETS_TO_PLAY,
  MATCH_SET_OPTIONS,
  PERSISTED_ADVANTAGE_POINT_VALUE,
  PERSISTED_GAME_POINT_VALUE,
  SCORE_POINTS,
  TEAM_IDENTIFIERS,
  TIE_BREAK_ENTRY_GAMES
} from './constants.js'

const supportedSetsToPlaySet = new Set(MATCH_SET_OPTIONS)
const supportedTeamIdentifierSet = new Set(TEAM_IDENTIFIERS)

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
export function isRecord(value) {
  return typeof value === 'object' && value !== null
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
export function toNonNegativeInteger(value, fallback = 0) {
  return isNonNegativeInteger(value) ? value : fallback
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
export function toPositiveInteger(value, fallback = 1) {
  return isPositiveInteger(value) ? value : fallback
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function toNonNegativeIntegerWithRequiredFallback(value, fallback) {
  return isNonNegativeInteger(value) ? value : fallback
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function toPositiveIntegerWithRequiredFallback(value, fallback) {
  return isPositiveInteger(value) ? value : fallback
}

/**
 * @param {unknown} value
 * @returns {value is 'teamA' | 'teamB'}
 */
export function isTeamIdentifier(value) {
  return supportedTeamIdentifierSet.has(value)
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSupportedSetsToPlay(value) {
  return supportedSetsToPlaySet.has(value)
}

/**
 * @param {unknown} teamAGames
 * @param {unknown} teamBGames
 * @returns {boolean}
 */
export function isTieBreakMode(teamAGames, teamBGames) {
  return (
    teamAGames === TIE_BREAK_ENTRY_GAMES && teamBGames === TIE_BREAK_ENTRY_GAMES
  )
}

/**
 * @param {{ currentSetStatus: { teamAGames: unknown, teamBGames: unknown } }} matchState
 * @returns {boolean}
 */
export function isTieBreakModeForState(matchState) {
  return isTieBreakMode(
    matchState.currentSetStatus.teamAGames,
    matchState.currentSetStatus.teamBGames
  )
}

/**
 * @param {unknown} matchState
 * @returns {'teamA' | 'teamB' | null}
 */
export function resolveWinnerTeam(matchState) {
  if (!isRecord(matchState)) {
    return null
  }

  if (isTeamIdentifier(matchState.winnerTeam)) {
    return matchState.winnerTeam
  }

  if (isRecord(matchState.winner) && isTeamIdentifier(matchState.winner.team)) {
    return matchState.winner.team
  }

  return null
}

/**
 * @param {unknown} primaryMatchState
 * @param {unknown} fallbackMatchState
 * @returns {'teamA' | 'teamB' | null}
 */
export function resolveWinnerTeamWithFallback(
  primaryMatchState,
  fallbackMatchState
) {
  const primaryWinnerTeam = resolveWinnerTeam(primaryMatchState)

  if (primaryWinnerTeam) {
    return primaryWinnerTeam
  }

  return resolveWinnerTeam(fallbackMatchState)
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function cloneMatchState(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

/**
 * @template T
 * @param {T} value
 * @returns {T | null}
 */
export function cloneMatchStateOrNull(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function toPersistedPointValue(value) {
  if (Number.isInteger(value) && value >= 0) {
    return value
  }

  if (value === SCORE_POINTS.ADVANTAGE) {
    return PERSISTED_ADVANTAGE_POINT_VALUE
  }

  if (value === SCORE_POINTS.GAME) {
    return PERSISTED_GAME_POINT_VALUE
  }

  return SCORE_POINTS.LOVE
}

/**
 * @param {unknown} value
 * @param {boolean} tieBreakMode
 * @param {number} [fallback]
 * @returns {number | import('./scoring-constants.js').ScorePoint}
 */
export function toRuntimePointValue(
  value,
  tieBreakMode,
  fallback = SCORE_POINTS.LOVE
) {
  if (!Number.isInteger(value) || value < 0) {
    return fallback
  }

  if (tieBreakMode) {
    return value
  }

  if (value === PERSISTED_ADVANTAGE_POINT_VALUE) {
    return SCORE_POINTS.ADVANTAGE
  }

  if (value === PERSISTED_GAME_POINT_VALUE) {
    return SCORE_POINTS.GAME
  }

  return value
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
export function toSupportedSetsToPlay(value, fallback = DEFAULT_SETS_TO_PLAY) {
  return isSupportedSetsToPlay(value) ? value : fallback
}

/**
 * @param {number} setsNeededToWin
 * @returns {number}
 */
export function resolveSetsToPlayFromSetsNeededToWin(setsNeededToWin) {
  if (setsNeededToWin <= 1) {
    return 1
  }

  if (setsNeededToWin >= 3) {
    return 5
  }

  return 3
}

/**
 * @param {number} setsToPlay
 * @param {number} setsNeededToWin
 * @returns {boolean}
 */
export function isSupportedSetConfiguration(setsToPlay, setsNeededToWin) {
  return Math.ceil(setsToPlay / 2) === setsNeededToWin
}

/**
 * @param {unknown} setHistory
 * @param {{ setNumberFallback?: 'index' | 'firstSet', sortBySetNumber?: boolean }} [options]
 * @returns {Array<{ setNumber: number, teamAGames: number, teamBGames: number }>}
 */
export function normalizeSetHistoryWithOptions(setHistory, options = {}) {
  if (!Array.isArray(setHistory)) {
    return []
  }

  const setNumberFallback =
    options.setNumberFallback === 'firstSet' ? 'firstSet' : 'index'
  const shouldSort = options.sortBySetNumber === true

  const normalizedSetHistory = setHistory.map((entry, index) => ({
    setNumber:
      setNumberFallback === 'firstSet'
        ? toPositiveInteger(entry?.setNumber, 1)
        : toPositiveInteger(entry?.setNumber, index + 1),
    teamAGames: toNonNegativeInteger(entry?.teamAGames, 0),
    teamBGames: toNonNegativeInteger(entry?.teamBGames, 0)
  }))

  if (!shouldSort) {
    return normalizedSetHistory
  }

  return normalizedSetHistory.sort(
    (leftEntry, rightEntry) => leftEntry.setNumber - rightEntry.setNumber
  )
}

/**
 * @param {unknown} setHistory
 * @returns {Array<{ setNumber: number, teamAGames: number, teamBGames: number }>}
 */
export function cloneSetHistory(setHistory) {
  return normalizeSetHistoryWithOptions(setHistory)
}

/**
 * @param {unknown} setHistory
 * @returns {Array<{ setNumber: number, teamAGames: number, teamBGames: number }>}
 */
export function cloneSetHistoryWithFirstSetFallback(setHistory) {
  return normalizeSetHistoryWithOptions(setHistory, {
    setNumberFallback: 'firstSet'
  })
}

/**
 * @param {unknown} setHistory
 * @returns {Array<{ setNumber: number, teamAGames: number, teamBGames: number }>}
 */
export function normalizeSetHistory(setHistory) {
  return normalizeSetHistoryWithOptions(setHistory, {
    setNumberFallback: 'index',
    sortBySetNumber: true
  })
}

/**
 * @param {unknown} entry
 * @returns {string}
 */
export function formatDate(entry) {
  if (!entry) {
    return ''
  }

  const pad = (value) => (value < 10 ? `0${value}` : String(value))

  if (entry.localTime && typeof entry.localTime === 'object') {
    const localTime = entry.localTime
    const day = localTime.day
    const month = localTime.month
    const year = localTime.year
    const hours = localTime.hour
    const minutes = localTime.minute

    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      Number.isFinite(year) &&
      Number.isFinite(hours) &&
      Number.isFinite(minutes)
    ) {
      return `${pad(day)}/${pad(month)}/${year} ${pad(hours)}:${pad(minutes)}`
    }
  }

  if (Number.isFinite(entry.completedAt)) {
    const completedAtDate = new Date(entry.completedAt)
    const day = completedAtDate.getDate()
    const month = completedAtDate.getMonth() + 1
    const year = completedAtDate.getFullYear()
    const hours = completedAtDate.getHours()
    const minutes = completedAtDate.getMinutes()

    return `${pad(day)}/${pad(month)}/${year} ${pad(hours)}:${pad(minutes)}`
  }

  return ''
}
