/**
 * @typedef {'active' | 'finished'} MatchStatus
 */

/**
 * @typedef {1 | 3 | 5} SetsToPlay
 */

/**
 * @typedef {1 | 2 | 3} SetsNeededToWin
 */

/**
 * @typedef TeamPairScore
 * @property {number} teamA
 * @property {number} teamB
 */

/**
 * @typedef CurrentSetState
 * @property {number} number
 * @property {TeamPairScore} games
 */

/**
 * @typedef CurrentGamePoints
 * @property {number} teamA
 * @property {number} teamB
 */

/**
 * @typedef CurrentGameState
 * @property {CurrentGamePoints} points
 */

/**
 * @typedef SetHistoryEntry
 * @property {number} setNumber
 * @property {number} teamAGames
 * @property {number} teamBGames
 */

/**
 * @typedef MatchState
 * @property {MatchStatus} status
 * @property {SetsToPlay} setsToPlay
 * @property {SetsNeededToWin} setsNeededToWin
 * @property {TeamPairScore} setsWon
 * @property {CurrentSetState} currentSet
 * @property {CurrentGameState} currentGame
 * @property {SetHistoryEntry[]} setHistory
 * @property {number} updatedAt
 * @property {number} schemaVersion
 */

/**
 * @typedef MatchStateV0
 * @property {MatchStatus} status
 * @property {SetsToPlay} setsToPlay
 * @property {SetsNeededToWin} setsNeededToWin
 * @property {TeamPairScore} setsWon
 * @property {CurrentSetState} currentSet
 * @property {CurrentGameState} currentGame
 * @property {SetHistoryEntry[]} setHistory
 * @property {number} updatedAt
 */

export const MATCH_STATUS = Object.freeze({
  ACTIVE: 'active',
  FINISHED: 'finished'
})

export const SETS_TO_PLAY = Object.freeze({
  ONE: 1,
  THREE: 3,
  FIVE: 5
})

export const SETS_NEEDED_TO_WIN = Object.freeze({
  ONE: 1,
  TWO: 2,
  THREE: 3
})

export const ACTIVE_MATCH_SESSION = 'ACTIVE_MATCH_SESSION'
export const STORAGE_KEY = ACTIVE_MATCH_SESSION
export const CURRENT_SCHEMA_VERSION = 1

const matchStatusSet = new Set(Object.values(MATCH_STATUS))
const setsToPlaySet = new Set(Object.values(SETS_TO_PLAY))
const setsNeededToWinSet = new Set(Object.values(SETS_NEEDED_TO_WIN))

const setsNeededToWinBySetsToPlay = Object.freeze({
  [SETS_TO_PLAY.ONE]: SETS_NEEDED_TO_WIN.ONE,
  [SETS_TO_PLAY.THREE]: SETS_NEEDED_TO_WIN.TWO,
  [SETS_TO_PLAY.FIVE]: SETS_NEEDED_TO_WIN.THREE
})

/**
 * @type {Map<number, (state: unknown) => MatchState>}
 */
const migrationRegistry = new Map([[0, migrateMatchStateV0ToV1]])

/**
 * @returns {TeamPairScore}
 */
function createZeroedTeamPairScore() {
  return {
    teamA: 0,
    teamB: 0
  }
}

/**
 * @returns {CurrentSetState}
 */
function createDefaultCurrentSetState() {
  return {
    number: 1,
    games: createZeroedTeamPairScore()
  }
}

/**
 * @returns {CurrentGameState}
 */
function createDefaultCurrentGameState() {
  return {
    points: createDefaultCurrentGamePoints()
  }
}

/**
 * @returns {CurrentGamePoints}
 */
function createDefaultCurrentGamePoints() {
  return {
    teamA: 0,
    teamB: 0
  }
}

/**
 * @returns {MatchState}
 */
export function createDefaultMatchState() {
  return {
    status: MATCH_STATUS.ACTIVE,
    setsToPlay: SETS_TO_PLAY.THREE,
    setsNeededToWin: SETS_NEEDED_TO_WIN.TWO,
    setsWon: createZeroedTeamPairScore(),
    currentSet: createDefaultCurrentSetState(),
    currentGame: createDefaultCurrentGameState(),
    setHistory: [],
    updatedAt: Date.now(),
    schemaVersion: CURRENT_SCHEMA_VERSION
  }
}

/**
 * @param {MatchState} state
 * @returns {string}
 */
export function serializeMatchState(state) {
  return JSON.stringify(state)
}

/**
 * @param {string} serializedState
 * @returns {MatchState | null}
 */
export function deserializeMatchState(serializedState) {
  if (typeof serializedState !== 'string' || serializedState.length === 0) {
    return null
  }

  try {
    const parsedState = JSON.parse(serializedState)
    return isMatchState(parsedState) ? parsedState : null
  } catch {
    return null
  }
}

/**
 * @param {unknown} rawData
 * @returns {MatchState}
 */
export function migrateMatchState(rawData) {
  const schemaVersion = resolveSchemaVersion(rawData)

  if (!Number.isInteger(schemaVersion)) {
    return createDefaultMatchState()
  }

  if (schemaVersion === CURRENT_SCHEMA_VERSION) {
    return isMatchState(rawData) ? rawData : createDefaultMatchState()
  }

  if (schemaVersion < 0 || schemaVersion > CURRENT_SCHEMA_VERSION) {
    return createDefaultMatchState()
  }

  let nextState = rawData

  for (
    let fromVersion = schemaVersion;
    fromVersion < CURRENT_SCHEMA_VERSION;
    fromVersion += 1
  ) {
    const migration = migrationRegistry.get(fromVersion)

    if (typeof migration !== 'function') {
      return createDefaultMatchState()
    }

    nextState = migration(nextState)
  }

  return isMatchState(nextState) ? nextState : createDefaultMatchState()
}

/**
 * @param {unknown} value
 * @returns {value is MatchState}
 */
export function isMatchState(value) {
  if (!isRecord(value)) {
    return false
  }

  return (
    isMatchStatus(value.status) &&
    isSetsToPlay(value.setsToPlay) &&
    isSetsNeededToWin(value.setsNeededToWin) &&
    isSupportedSetConfiguration(value.setsToPlay, value.setsNeededToWin) &&
    isTeamPairScore(value.setsWon) &&
    isCurrentSetState(value.currentSet) &&
    isCurrentGameState(value.currentGame) &&
    isSetHistory(value.setHistory) &&
    isNonNegativeInteger(value.updatedAt) &&
    isPositiveInteger(value.schemaVersion)
  )
}

/**
 * @param {unknown} value
 * @returns {value is MatchStateV0}
 */
function isMatchStateV0(value) {
  if (!isRecord(value)) {
    return false
  }

  return (
    isMatchStatus(value.status) &&
    isSetsToPlay(value.setsToPlay) &&
    isSetsNeededToWin(value.setsNeededToWin) &&
    isSupportedSetConfiguration(value.setsToPlay, value.setsNeededToWin) &&
    isTeamPairScore(value.setsWon) &&
    isCurrentSetState(value.currentSet) &&
    isCurrentGameState(value.currentGame) &&
    isSetHistory(value.setHistory) &&
    isNonNegativeInteger(value.updatedAt)
  )
}

/**
 * @param {unknown} rawData
 * @returns {number | null}
 */
function resolveSchemaVersion(rawData) {
  if (!isRecord(rawData)) {
    return null
  }

  if (!Object.prototype.hasOwnProperty.call(rawData, 'schemaVersion')) {
    return isMatchStateV0(rawData) ? 0 : null
  }

  if (rawData.schemaVersion === 0) {
    return isMatchStateV0(rawData) ? 0 : null
  }

  return isPositiveInteger(rawData.schemaVersion) ? rawData.schemaVersion : null
}

/**
 * @param {unknown} state
 * @returns {MatchState}
 */
function migrateMatchStateV0ToV1(state) {
  if (!isMatchStateV0(state)) {
    return createDefaultMatchState()
  }

  return {
    status: state.status,
    setsToPlay: state.setsToPlay,
    setsNeededToWin: state.setsNeededToWin,
    setsWon: {
      teamA: state.setsWon.teamA,
      teamB: state.setsWon.teamB
    },
    currentSet: {
      number: state.currentSet.number,
      games: {
        teamA: state.currentSet.games.teamA,
        teamB: state.currentSet.games.teamB
      }
    },
    currentGame: {
      points: {
        teamA: state.currentGame.points.teamA,
        teamB: state.currentGame.points.teamB
      }
    },
    setHistory: state.setHistory.map((entry) => ({
      setNumber: entry.setNumber,
      teamAGames: entry.teamAGames,
      teamBGames: entry.teamBGames
    })),
    updatedAt: state.updatedAt,
    schemaVersion: CURRENT_SCHEMA_VERSION
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null
}

/**
 * @param {unknown} value
 * @returns {value is MatchStatus}
 */
function isMatchStatus(value) {
  return matchStatusSet.has(value)
}

/**
 * @param {unknown} value
 * @returns {value is SetsToPlay}
 */
function isSetsToPlay(value) {
  return setsToPlaySet.has(value)
}

/**
 * @param {unknown} value
 * @returns {value is SetsNeededToWin}
 */
function isSetsNeededToWin(value) {
  return setsNeededToWinSet.has(value)
}

/**
 * @param {SetsToPlay} setsToPlay
 * @param {SetsNeededToWin} setsNeededToWin
 * @returns {boolean}
 */
function isSupportedSetConfiguration(setsToPlay, setsNeededToWin) {
  return setsNeededToWinBySetsToPlay[setsToPlay] === setsNeededToWin
}

/**
 * @param {unknown} value
 * @returns {value is TeamPairScore}
 */
function isTeamPairScore(value) {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.teamA) &&
    isNonNegativeInteger(value.teamB)
  )
}

/**
 * @param {unknown} value
 * @returns {value is CurrentSetState}
 */
function isCurrentSetState(value) {
  return (
    isRecord(value) &&
    isPositiveInteger(value.number) &&
    isTeamPairScore(value.games)
  )
}

/**
 * @param {unknown} value
 * @returns {value is CurrentGameState}
 */
function isCurrentGameState(value) {
  return isRecord(value) && isCurrentGamePoints(value.points)
}

/**
 * @param {unknown} value
 * @returns {value is CurrentGamePoints}
 */
function isCurrentGamePoints(value) {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.teamA) &&
    isNonNegativeInteger(value.teamB)
  )
}

/**
 * @param {unknown} value
 * @returns {value is SetHistoryEntry[]}
 */
function isSetHistory(value) {
  return Array.isArray(value) && value.every((entry) => isSetHistoryEntry(entry))
}

/**
 * @param {unknown} value
 * @returns {value is SetHistoryEntry}
 */
function isSetHistoryEntry(value) {
  return (
    isRecord(value) &&
    isPositiveInteger(value.setNumber) &&
    isNonNegativeInteger(value.teamAGames) &&
    isNonNegativeInteger(value.teamBGames)
  )
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}
