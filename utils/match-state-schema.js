/**
 * @typedef {'teamA' | 'teamB'} TeamId
 */

/**
 * @typedef {'active' | 'paused' | 'finished'} MatchStatus
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
 * @typedef MatchTeamIdentity
 * @property {TeamId} id
 * @property {string} label
 */

/**
 * @typedef MatchTeams
 * @property {MatchTeamIdentity} teamA
 * @property {MatchTeamIdentity} teamB
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
 * @typedef MatchScores
 * @property {TeamPairScore} setsWon
 * @property {CurrentSetState} currentSet
 * @property {CurrentGameState} currentGame
 */

/**
 * @typedef MatchSettings
 * @property {SetsToPlay} setsToPlay
 * @property {SetsNeededToWin} setsNeededToWin
 */

/**
 * @typedef MatchMetadata
 * @property {string} matchId
 */

/**
 * @typedef MatchTiming
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string | null} startedAt
 * @property {string | null} finishedAt
 */

/**
 * @typedef SetHistoryEntry
 * @property {number} setNumber
 * @property {number} teamAGames
 * @property {number} teamBGames
 */

/**
 * @typedef MatchState
 * @property {MatchTeams} teams
 * @property {MatchScores} scores
 * @property {MatchSettings} settings
 * @property {MatchStatus} status
 * @property {MatchMetadata} metadata
 * @property {MatchTiming} timing
 * @property {SetHistoryEntry[]} setHistory
 * @property {number} schemaVersion
 * @property {SetsToPlay} setsToPlay
 * @property {SetsNeededToWin} setsNeededToWin
 * @property {TeamPairScore} setsWon
 * @property {CurrentSetState} currentSet
 * @property {CurrentGameState} currentGame
 * @property {number} updatedAt
 * @property {TeamId} [winnerTeam]
 * @property {{ team: TeamId }} [winner]
 * @property {number} [completedAt]
 */

/**
 * @typedef MatchStateV1
 * @property {'active' | 'finished'} status
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
 * @property {'active' | 'finished'} status
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
  PAUSED: 'paused',
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
export const CURRENT_SCHEMA_VERSION = 2

const TEAM_ID = Object.freeze({
  A: 'teamA',
  B: 'teamB'
})

const DEFAULT_TEAM_LABELS = Object.freeze({
  teamA: 'Team A',
  teamB: 'Team B'
})

const ISO_8601_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ISO_8601_UTC_PARTS_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/
const MATCH_ID_PATTERN = /^match-[a-z0-9]+(?:-[a-z0-9]+)*$/

const matchStatusSet = new Set(Object.values(MATCH_STATUS))
const legacyMatchStatusSet = new Set([
  MATCH_STATUS.ACTIVE,
  MATCH_STATUS.FINISHED
])
const setsToPlaySet = new Set(Object.values(SETS_TO_PLAY))
const setsNeededToWinSet = new Set(Object.values(SETS_NEEDED_TO_WIN))

const setsNeededToWinBySetsToPlay = Object.freeze({
  [SETS_TO_PLAY.ONE]: SETS_NEEDED_TO_WIN.ONE,
  [SETS_TO_PLAY.THREE]: SETS_NEEDED_TO_WIN.TWO,
  [SETS_TO_PLAY.FIVE]: SETS_NEEDED_TO_WIN.THREE
})

/**
 * @type {Map<number, (state: unknown) => unknown>}
 */
const migrationRegistry = new Map([
  [0, migrateMatchStateV0ToV1],
  [1, migrateMatchStateV1ToV2]
])

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
 * @returns {MatchTeams}
 */
function createDefaultTeams() {
  return {
    teamA: {
      id: TEAM_ID.A,
      label: DEFAULT_TEAM_LABELS.teamA
    },
    teamB: {
      id: TEAM_ID.B,
      label: DEFAULT_TEAM_LABELS.teamB
    }
  }
}

/**
 * @returns {MatchSettings}
 */
function createDefaultSettings() {
  return {
    setsToPlay: SETS_TO_PLAY.THREE,
    setsNeededToWin: SETS_NEEDED_TO_WIN.TWO
  }
}

/**
 * @returns {MatchScores}
 */
function createDefaultScores() {
  return {
    setsWon: createZeroedTeamPairScore(),
    currentSet: createDefaultCurrentSetState(),
    currentGame: createDefaultCurrentGameState()
  }
}

/**
 * @param {number} timestamp
 * @returns {MatchMetadata}
 */
function createDefaultMetadata(timestamp) {
  return {
    matchId: createMatchId(timestamp)
  }
}

/**
 * @param {number} timestamp
 * @param {MatchStatus} status
 * @returns {MatchTiming}
 */
function createDefaultTiming(timestamp, status) {
  const updatedAtIso = toIsoTimestamp(timestamp)
  return {
    createdAt: updatedAtIso,
    updatedAt: updatedAtIso,
    startedAt: updatedAtIso,
    finishedAt: status === MATCH_STATUS.FINISHED ? updatedAtIso : null
  }
}

/**
 * @returns {MatchState}
 */
export function createDefaultMatchState() {
  const timestamp = Date.now()
  return buildNormalizedMatchState({
    status: MATCH_STATUS.ACTIVE,
    settings: createDefaultSettings(),
    scores: createDefaultScores(),
    teams: createDefaultTeams(),
    metadata: createDefaultMetadata(timestamp),
    timing: createDefaultTiming(timestamp, MATCH_STATUS.ACTIVE),
    setHistory: [],
    source: null
  })
}

/**
 * @param {unknown} value
 * @returns {value is MatchState}
 */
export function validateMatchSession(value) {
  return isCanonicalMatchState(value)
}

/**
 * Lightweight structural check — no Date calls, no Object.hasOwn.
 * Used on the hot storage path so it works on Zepp OS ES6 runtime.
 * @param {unknown} value
 * @returns {value is MatchState}
 */
export function isMatchState(value) {
  if (!isRecord(value)) {
    return false
  }

  if (!matchStatusSet.has(value.status)) {
    return false
  }

  if (
    !isSetsToPlay(value.setsToPlay) ||
    !isSetsNeededToWin(value.setsNeededToWin)
  ) {
    return false
  }

  if (!isTeamPairScore(value.setsWon)) {
    return false
  }

  if (!isCurrentSetState(value.currentSet)) {
    return false
  }

  if (!isCurrentGameState(value.currentGame)) {
    return false
  }

  if (!Array.isArray(value.setHistory)) {
    return false
  }

  return isNonNegativeInteger(value.updatedAt)
}

/**
 * @param {unknown} state
 * @returns {string}
 */
export function serializeMatchSession(state) {
  // Use tryNormalizeMatchState only in non-device environments (tests/Node).
  // On device (Zepp OS ES6), fall back to direct JSON serialization when
  // the state passes the lightweight isMatchState check, to avoid Date crashes.
  let normalized = null
  try {
    normalized = tryNormalizeMatchState(state)
  } catch {
    normalized = null
  }

  if (normalized) {
    return JSON.stringify(normalized)
  }

  if (isMatchState(state)) {
    return JSON.stringify(state)
  }

  throw new TypeError('Cannot serialize an invalid match session payload.')
}

/**
 * @param {string} serializedState
 * @returns {MatchState | null}
 */
export function deserializeMatchSession(serializedState) {
  if (typeof serializedState !== 'string' || serializedState.length === 0) {
    return null
  }

  try {
    const parsedState = JSON.parse(serializedState)

    // Try full normalization/migration first (works in Node/test environments).
    let normalized = null
    try {
      normalized = tryDeserializeOrMigrateMatchState(parsedState)
    } catch {
      normalized = null
    }

    if (normalized) {
      return normalized
    }

    // Fallback: if the stored data passes the lightweight check, return it as-is.
    // This covers Zepp OS where Date-based normalization is unavailable.
    return isMatchState(parsedState) ? parsedState : null
  } catch {
    return null
  }
}

/**
 * @param {unknown} state
 * @returns {string}
 */
export function serializeMatchState(state) {
  return serializeMatchSession(state)
}

/**
 * @param {string} serializedState
 * @returns {MatchState | null}
 */
export function deserializeMatchState(serializedState) {
  return deserializeMatchSession(serializedState)
}

/**
 * @param {unknown} rawData
 * @returns {MatchState}
 */
export function migrateMatchState(rawData) {
  return tryDeserializeOrMigrateMatchState(rawData) ?? createDefaultMatchState()
}

/**
 * @param {unknown} rawData
 * @returns {MatchState | null}
 */
function tryDeserializeOrMigrateMatchState(rawData) {
  const schemaVersion = resolveSchemaVersion(rawData)

  if (!Number.isInteger(schemaVersion)) {
    return null
  }

  if (schemaVersion < 0 || schemaVersion > CURRENT_SCHEMA_VERSION) {
    return null
  }

  if (
    schemaVersion === CURRENT_SCHEMA_VERSION &&
    isCanonicalMatchState(rawData)
  ) {
    return rawData
  }

  let nextState = rawData

  for (
    let fromVersion = schemaVersion;
    fromVersion < CURRENT_SCHEMA_VERSION;
    fromVersion += 1
  ) {
    const migration = migrationRegistry.get(fromVersion)

    if (typeof migration !== 'function') {
      return null
    }

    nextState = migration(nextState)

    if (nextState === null) {
      return null
    }
  }

  return tryNormalizeMatchState(nextState)
}

/**
 * @param {unknown} value
 * @returns {MatchState | null}
 */
function tryNormalizeMatchState(value) {
  if (!isRecord(value)) {
    return null
  }

  if (!isPositiveInteger(value.schemaVersion)) {
    return null
  }

  if (!isMatchStatus(value.status)) {
    return null
  }

  const settings = extractSettings(value)
  if (!settings) {
    return null
  }

  const scores = extractScores(value)
  if (!scores) {
    return null
  }

  if (!isSetHistory(value.setHistory)) {
    return null
  }

  const updatedAtFromTopLevel = isNonNegativeInteger(value.updatedAt)
    ? value.updatedAt
    : null
  const updatedAtFromTiming = readTimestampCandidate(value?.timing?.updatedAt)
  const updatedAt = updatedAtFromTopLevel ?? updatedAtFromTiming ?? Date.now()

  const teams = normalizeTeams(value.teams)
  const metadata = normalizeMetadata(value.metadata, updatedAt)
  const timing = normalizeTiming(value.timing, updatedAt, value.status)

  if (!timing) {
    return null
  }

  return buildNormalizedMatchState({
    status: value.status,
    settings,
    scores,
    teams,
    metadata,
    timing,
    setHistory: value.setHistory,
    source: value
  })
}

/**
 * @param {unknown} value
 * @returns {value is MatchState}
 */
function isCanonicalMatchState(value) {
  if (!isRecord(value)) {
    return false
  }

  if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return false
  }

  if (!isMatchStatus(value.status)) {
    return false
  }

  if (!isMatchTeams(value.teams)) {
    return false
  }

  if (!isMatchSettings(value.settings)) {
    return false
  }

  if (
    !isSupportedSetConfiguration(
      value.settings.setsToPlay,
      value.settings.setsNeededToWin
    )
  ) {
    return false
  }

  if (!isMatchScores(value.scores)) {
    return false
  }

  if (!isSetHistory(value.setHistory)) {
    return false
  }

  if (!isMatchMetadata(value.metadata)) {
    return false
  }

  if (!isMatchTiming(value.timing, value.status)) {
    return false
  }

  if (!isSetsToPlay(value.setsToPlay)) {
    return false
  }

  if (!isSetsNeededToWin(value.setsNeededToWin)) {
    return false
  }

  if (!isTeamPairScore(value.setsWon)) {
    return false
  }

  if (!isCurrentSetState(value.currentSet)) {
    return false
  }

  if (!isCurrentGameState(value.currentGame)) {
    return false
  }

  if (!isNonNegativeInteger(value.updatedAt)) {
    return false
  }

  const updatedAtFromTiming = readTimestampCandidate(value.timing.updatedAt)

  if (updatedAtFromTiming === null || value.updatedAt !== updatedAtFromTiming) {
    return false
  }

  return (
    value.setsToPlay === value.settings.setsToPlay &&
    value.setsNeededToWin === value.settings.setsNeededToWin &&
    isTeamPairScoreEqual(value.setsWon, value.scores.setsWon) &&
    isCurrentSetStateEqual(value.currentSet, value.scores.currentSet) &&
    isCurrentGameStateEqual(value.currentGame, value.scores.currentGame)
  )
}

/**
 * @param {unknown} value
 * @returns {value is MatchStateV1}
 */
function isMatchStateV1(value) {
  if (!isRecord(value)) {
    return false
  }

  return (
    legacyMatchStatusSet.has(value.status) &&
    isSetsToPlay(value.setsToPlay) &&
    isSetsNeededToWin(value.setsNeededToWin) &&
    isSupportedSetConfiguration(value.setsToPlay, value.setsNeededToWin) &&
    isTeamPairScore(value.setsWon) &&
    isCurrentSetState(value.currentSet) &&
    isCurrentGameState(value.currentGame) &&
    isSetHistory(value.setHistory) &&
    isNonNegativeInteger(value.updatedAt) &&
    value.schemaVersion === 1
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
    legacyMatchStatusSet.has(value.status) &&
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

  // Use 'in' operator instead of Object.hasOwn (ES2022) for ES6 compatibility
  if (!('schemaVersion' in rawData)) {
    return isMatchStateV0(rawData) ? 0 : null
  }

  if (rawData.schemaVersion === 0) {
    return isMatchStateV0(rawData) ? 0 : null
  }

  if (!isPositiveInteger(rawData.schemaVersion)) {
    return null
  }

  return rawData.schemaVersion
}

/**
 * @param {unknown} state
 * @returns {MatchStateV1 | null}
 */
function migrateMatchStateV0ToV1(state) {
  if (!isMatchStateV0(state)) {
    return null
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
    schemaVersion: 1
  }
}

/**
 * @param {unknown} state
 * @returns {MatchState | null}
 */
function migrateMatchStateV1ToV2(state) {
  if (!isMatchStateV1(state)) {
    return null
  }

  return tryNormalizeMatchState({
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    teams: state.teams,
    settings: {
      setsToPlay: state.setsToPlay,
      setsNeededToWin: state.setsNeededToWin
    },
    scores: {
      setsWon: state.setsWon,
      currentSet: state.currentSet,
      currentGame: state.currentGame
    },
    metadata: state.metadata,
    timing: state.timing
  })
}

/**
 * @param {{
 *   status: MatchStatus,
 *   settings: MatchSettings,
 *   scores: MatchScores,
 *   teams: MatchTeams,
 *   metadata: MatchMetadata,
 *   timing: MatchTiming,
 *   setHistory: SetHistoryEntry[],
 *   source: unknown
 * }} params
 * @returns {MatchState}
 */
function buildNormalizedMatchState(params) {
  const setsWon = cloneTeamPairScore(params.scores.setsWon)
  const currentSet = cloneCurrentSetState(params.scores.currentSet)
  const currentGame = cloneCurrentGameState(params.scores.currentGame)
  const scores = {
    setsWon,
    currentSet,
    currentGame
  }
  const updatedAt =
    readTimestampCandidate(params.timing.updatedAt) ?? Date.now()

  /** @type {MatchState} */
  const matchState = {
    teams: cloneTeams(params.teams),
    scores,
    settings: {
      setsToPlay: params.settings.setsToPlay,
      setsNeededToWin: params.settings.setsNeededToWin
    },
    status: params.status,
    metadata: {
      matchId: params.metadata.matchId
    },
    timing: {
      createdAt: params.timing.createdAt,
      updatedAt: params.timing.updatedAt,
      startedAt: params.timing.startedAt,
      finishedAt: params.timing.finishedAt
    },
    setHistory: params.setHistory.map((entry) => ({
      setNumber: entry.setNumber,
      teamAGames: entry.teamAGames,
      teamBGames: entry.teamBGames
    })),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    setsToPlay: params.settings.setsToPlay,
    setsNeededToWin: params.settings.setsNeededToWin,
    setsWon,
    currentSet,
    currentGame,
    updatedAt
  }

  if (isRecord(params.source)) {
    if (isTeamId(params.source.winnerTeam)) {
      matchState.winnerTeam = params.source.winnerTeam
    }

    if (isRecord(params.source.winner) && isTeamId(params.source.winner.team)) {
      matchState.winner = {
        team: params.source.winner.team
      }
    }

    if (isNonNegativeInteger(params.source.completedAt)) {
      matchState.completedAt = params.source.completedAt
    } else {
      const finishedAt = readTimestampCandidate(matchState.timing.finishedAt)
      if (finishedAt !== null) {
        matchState.completedAt = finishedAt
      }
    }
  }

  return matchState
}

/**
 * @param {unknown} value
 * @returns {MatchSettings | null}
 */
function extractSettings(value) {
  if (!isRecord(value)) {
    return null
  }

  const hasTopLevelSettings =
    'setsToPlay' in value || 'setsNeededToWin' in value

  const fromTopLevel = {
    setsToPlay: value.setsToPlay,
    setsNeededToWin: value.setsNeededToWin
  }

  if (
    isMatchSettings(fromTopLevel) &&
    isSupportedSetConfiguration(
      fromTopLevel.setsToPlay,
      fromTopLevel.setsNeededToWin
    )
  ) {
    return {
      setsToPlay: fromTopLevel.setsToPlay,
      setsNeededToWin: fromTopLevel.setsNeededToWin
    }
  }

  if (hasTopLevelSettings) {
    return null
  }

  if (!isMatchSettings(value.settings)) {
    return null
  }

  if (
    !isSupportedSetConfiguration(
      value.settings.setsToPlay,
      value.settings.setsNeededToWin
    )
  ) {
    return null
  }

  return {
    setsToPlay: value.settings.setsToPlay,
    setsNeededToWin: value.settings.setsNeededToWin
  }
}

/**
 * @param {unknown} value
 * @returns {MatchScores | null}
 */
function extractScores(value) {
  if (!isRecord(value)) {
    return null
  }

  const hasTopLevelScores =
    'setsWon' in value || 'currentSet' in value || 'currentGame' in value

  if (
    isTeamPairScore(value.setsWon) &&
    isCurrentSetState(value.currentSet) &&
    isCurrentGameState(value.currentGame)
  ) {
    return {
      setsWon: cloneTeamPairScore(value.setsWon),
      currentSet: cloneCurrentSetState(value.currentSet),
      currentGame: cloneCurrentGameState(value.currentGame)
    }
  }

  if (hasTopLevelScores) {
    return null
  }

  if (!isMatchScores(value.scores)) {
    return null
  }

  return {
    setsWon: cloneTeamPairScore(value.scores.setsWon),
    currentSet: cloneCurrentSetState(value.scores.currentSet),
    currentGame: cloneCurrentGameState(value.scores.currentGame)
  }
}

/**
 * @param {unknown} value
 * @returns {MatchTeams}
 */
function normalizeTeams(value) {
  if (!isRecord(value)) {
    return createDefaultTeams()
  }

  const teamALabel =
    typeof value?.teamA?.label === 'string' &&
    value.teamA.label.trim().length > 0
      ? value.teamA.label
      : DEFAULT_TEAM_LABELS.teamA

  const teamBLabel =
    typeof value?.teamB?.label === 'string' &&
    value.teamB.label.trim().length > 0
      ? value.teamB.label
      : DEFAULT_TEAM_LABELS.teamB

  return {
    teamA: {
      id: TEAM_ID.A,
      label: teamALabel
    },
    teamB: {
      id: TEAM_ID.B,
      label: teamBLabel
    }
  }
}

/**
 * @param {unknown} value
 * @param {number} fallbackTimestamp
 * @returns {MatchMetadata}
 */
function normalizeMetadata(value, fallbackTimestamp) {
  if (isRecord(value) && typeof value.matchId === 'string') {
    const normalizedMatchId = value.matchId.trim().toLowerCase()

    if (MATCH_ID_PATTERN.test(normalizedMatchId)) {
      return {
        matchId: normalizedMatchId
      }
    }
  }

  return {
    matchId: createMatchId(fallbackTimestamp)
  }
}

/**
 * @param {unknown} value
 * @param {number} fallbackTimestamp
 * @param {MatchStatus} status
 * @returns {MatchTiming | null}
 */
function normalizeTiming(value, fallbackTimestamp, status) {
  const updatedAt = fallbackTimestamp
  const createdAt = readTimestampCandidate(value?.createdAt) ?? updatedAt

  const normalizedCreatedAt = toIsoTimestamp(createdAt)
  const normalizedUpdatedAt = toIsoTimestamp(updatedAt)

  const startedAtCandidate = readTimestampCandidate(value?.startedAt)
  const startedAt =
    startedAtCandidate === null
      ? normalizedCreatedAt
      : toIsoTimestamp(startedAtCandidate)

  if (!isIsoTimestampString(normalizedCreatedAt)) {
    return null
  }

  if (!isIsoTimestampString(normalizedUpdatedAt)) {
    return null
  }

  if (!isIsoTimestampString(startedAt)) {
    return null
  }

  if (status === MATCH_STATUS.FINISHED) {
    const finishedAtCandidate =
      readTimestampCandidate(value?.finishedAt) ?? updatedAt
    const finishedAt = toIsoTimestamp(finishedAtCandidate)

    if (!isIsoTimestampString(finishedAt)) {
      return null
    }

    return {
      createdAt: normalizedCreatedAt,
      updatedAt: normalizedUpdatedAt,
      startedAt,
      finishedAt
    }
  }

  return {
    createdAt: normalizedCreatedAt,
    updatedAt: normalizedUpdatedAt,
    startedAt,
    finishedAt: null
  }
}

/**
 * @param {number} timestamp
 * @returns {string}
 */
function createMatchId(timestamp) {
  return `match-${Math.max(0, timestamp)}`
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
 * @returns {value is TeamId}
 */
function isTeamId(value) {
  return value === TEAM_ID.A || value === TEAM_ID.B
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
 * @returns {value is MatchTeams}
 */
function isMatchTeams(value) {
  return (
    isRecord(value) &&
    isTeamIdentity(value.teamA, TEAM_ID.A) &&
    isTeamIdentity(value.teamB, TEAM_ID.B)
  )
}

/**
 * @param {unknown} value
 * @param {TeamId} teamId
 * @returns {boolean}
 */
function isTeamIdentity(value, teamId) {
  return (
    isRecord(value) &&
    value.id === teamId &&
    typeof value.label === 'string' &&
    value.label.trim().length > 0
  )
}

/**
 * @param {unknown} value
 * @returns {value is MatchScores}
 */
function isMatchScores(value) {
  return (
    isRecord(value) &&
    isTeamPairScore(value.setsWon) &&
    isCurrentSetState(value.currentSet) &&
    isCurrentGameState(value.currentGame)
  )
}

/**
 * @param {unknown} value
 * @returns {value is MatchSettings}
 */
function isMatchSettings(value) {
  return (
    isRecord(value) &&
    isSetsToPlay(value.setsToPlay) &&
    isSetsNeededToWin(value.setsNeededToWin)
  )
}

/**
 * @param {unknown} value
 * @returns {value is MatchMetadata}
 */
function isMatchMetadata(value) {
  return (
    isRecord(value) &&
    typeof value.matchId === 'string' &&
    MATCH_ID_PATTERN.test(value.matchId)
  )
}

/**
 * @param {unknown} value
 * @param {MatchStatus} status
 * @returns {value is MatchTiming}
 */
function isMatchTiming(value, status) {
  if (!isRecord(value)) {
    return false
  }

  if (!isIsoTimestampString(value.createdAt)) {
    return false
  }

  if (!isIsoTimestampString(value.updatedAt)) {
    return false
  }

  if (!isNullableIsoTimestamp(value.startedAt)) {
    return false
  }

  if (!isNullableIsoTimestamp(value.finishedAt)) {
    return false
  }

  if (status === MATCH_STATUS.FINISHED && value.finishedAt === null) {
    return false
  }

  if (status !== MATCH_STATUS.FINISHED && value.finishedAt !== null) {
    return false
  }

  return true
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
  return (
    Array.isArray(value) && value.every((entry) => isSetHistoryEntry(entry))
  )
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
 * @returns {boolean}
 */
function isIsoTimestampString(value) {
  if (typeof value !== 'string') {
    return false
  }
  // Standard ISO-8601 UTC format
  if (ISO_8601_UTC_PATTERN.test(value)) {
    return readTimestampCandidate(value) !== null
  }
  // Numeric fallback format used on Zepp OS where Date methods are limited
  if (value.length > 1 && value[0] === '@') {
    const n = Number(value.slice(1))
    return Number.isFinite(n) && n >= 0
  }
  return false
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNullableIsoTimestamp(value) {
  return value === null || isIsoTimestampString(value)
}

/**
 * @param {string} value
 * @returns {number | null}
 */
function readCanonicalIsoTimestamp(value) {
  const parts = ISO_8601_UTC_PARTS_PATTERN.exec(value)

  if (!parts || typeof Date.UTC !== 'function') {
    return null
  }

  const year = Number(parts[1])
  const month = Number(parts[2])
  const day = Number(parts[3])
  const hours = Number(parts[4])
  const minutes = Number(parts[5])
  const seconds = Number(parts[6])
  const milliseconds = Number(parts[7])

  const timestamp = Date.UTC(
    year,
    month - 1,
    day,
    hours,
    minutes,
    seconds,
    milliseconds
  )

  if (!Number.isFinite(timestamp) || timestamp < 0) {
    return null
  }

  const parsedDate = new Date(timestamp)

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day ||
    parsedDate.getUTCHours() !== hours ||
    parsedDate.getUTCMinutes() !== minutes ||
    parsedDate.getUTCSeconds() !== seconds ||
    parsedDate.getUTCMilliseconds() !== milliseconds
  ) {
    return null
  }

  return Math.trunc(timestamp)
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function readTimestampCandidate(value) {
  if (isNonNegativeInteger(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  // Numeric fallback format: '@<milliseconds>'
  if (value.length > 1 && value[0] === '@') {
    const n = Number(value.slice(1))
    if (Number.isFinite(n) && n >= 0) {
      return Math.trunc(n)
    }
    return null
  }

  const canonicalTimestamp = readCanonicalIsoTimestamp(value)

  if (canonicalTimestamp !== null) {
    return canonicalTimestamp
  }

  if (typeof Date.parse !== 'function') {
    return null
  }

  let timestamp = Number.NaN

  try {
    timestamp = Date.parse(value)
  } catch {
    return null
  }

  if (!Number.isFinite(timestamp) || timestamp < 0) {
    return null
  }

  return Math.trunc(timestamp)
}

/**
 * @param {number} timestamp
 * @returns {string}
 */
export function toIsoTimestampSafe(timestamp) {
  return toIsoTimestamp(timestamp)
}

function toIsoTimestamp(timestamp) {
  const safeTs = Math.max(0, Math.trunc(timestamp))

  // Try toISOString() — standard ES5/ES6 but absent on some Zepp OS builds
  try {
    const d = new Date(safeTs)
    if (typeof d.toISOString === 'function') {
      const iso = d.toISOString()
      if (typeof iso === 'string' && iso.length > 0) {
        return iso
      }
    }
  } catch {
    // fall through
  }

  // Try UTC getter methods — present in most ES5+ engines
  try {
    const d = new Date(safeTs)
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    const hours = d.getUTCHours()
    const minutes = d.getUTCMinutes()
    const seconds = d.getUTCSeconds()
    const ms = d.getUTCMilliseconds()

    if (
      typeof year === 'number' &&
      year > 0 &&
      typeof month === 'number' &&
      typeof day === 'number'
    ) {
      const p2 = (n) => (n < 10 ? `0${n}` : `${n}`)
      const p3 = (n) => (n < 10 ? `00${n}` : n < 100 ? `0${n}` : `${n}`)
      const p4 = (n) =>
        n < 10 ? `000${n}` : n < 100 ? `00${n}` : n < 1000 ? `0${n}` : `${n}`
      return `${p4(year)}-${p2(month)}-${p2(day)}T${p2(hours)}:${p2(minutes)}:${p2(seconds)}.${p3(ms)}Z`
    }
  } catch {
    // fall through
  }

  // Final fallback: store as numeric string — accepted by readTimestampCandidate
  // and isIsoTimestampString (see below) so round-trip works on constrained runtimes
  return `@${safeTs}`
}

/**
 * @param {TeamPairScore} score
 * @returns {TeamPairScore}
 */
function cloneTeamPairScore(score) {
  return {
    teamA: score.teamA,
    teamB: score.teamB
  }
}

/**
 * @param {CurrentSetState} currentSet
 * @returns {CurrentSetState}
 */
function cloneCurrentSetState(currentSet) {
  return {
    number: currentSet.number,
    games: cloneTeamPairScore(currentSet.games)
  }
}

/**
 * @param {CurrentGameState} currentGame
 * @returns {CurrentGameState}
 */
function cloneCurrentGameState(currentGame) {
  return {
    points: {
      teamA: currentGame.points.teamA,
      teamB: currentGame.points.teamB
    }
  }
}

/**
 * @param {MatchTeams} teams
 * @returns {MatchTeams}
 */
function cloneTeams(teams) {
  return {
    teamA: {
      id: TEAM_ID.A,
      label: teams.teamA.label
    },
    teamB: {
      id: TEAM_ID.B,
      label: teams.teamB.label
    }
  }
}

/**
 * @param {TeamPairScore} left
 * @param {TeamPairScore} right
 * @returns {boolean}
 */
function isTeamPairScoreEqual(left, right) {
  return left.teamA === right.teamA && left.teamB === right.teamB
}

/**
 * @param {CurrentSetState} left
 * @param {CurrentSetState} right
 * @returns {boolean}
 */
function isCurrentSetStateEqual(left, right) {
  return (
    left.number === right.number &&
    isTeamPairScoreEqual(left.games, right.games)
  )
}

/**
 * @param {CurrentGameState} left
 * @param {CurrentGameState} right
 * @returns {boolean}
 */
function isCurrentGameStateEqual(left, right) {
  return (
    left.points.teamA === right.points.teamA &&
    left.points.teamB === right.points.teamB
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
