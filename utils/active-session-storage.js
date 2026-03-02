import {
  CURRENT_SCHEMA_VERSION,
  isMatchState,
  STORAGE_KEY as LEGACY_ACTIVE_SESSION_STORAGE_KEY,
  MATCH_STATUS,
  migrateMatchState,
  SETS_NEEDED_TO_WIN,
  SETS_TO_PLAY,
  serializeMatchState
} from './match-state-schema.js'
import {
  clearLegacyActiveSession,
  MATCH_STATE_STORAGE_KEY as LEGACY_RUNTIME_STORAGE_KEY,
  loadLegacyActiveSession
} from './storage.js'

/**
 * @typedef {import('./match-state-schema.js').MatchState & {
 *   teams?: {
 *     teamA?: { id?: string, label?: string },
 *     teamB?: { id?: string, label?: string }
 *   },
 *   winnerTeam?: 'teamA' | 'teamB',
 *   winner?: { team?: 'teamA' | 'teamB' },
 *   completedAt?: number
 * }} ActiveSession
 */

/**
 * @typedef {{
 *   migrated: boolean,
 *   source: string | null,
 *   didCleanupLegacy: boolean,
 *   reason: string | null
 * }} LegacyMigrationResult
 */

const LOG_PREFIX = '[active-session-storage]'

const FS_O_RDONLY = 0
const FS_O_WRONLY = 1
const FS_O_CREAT = 64
const FS_O_TRUNC = 512

export const ACTIVE_SESSION_FILE_PATH = '/data/active_session.json'

const LEGACY_ACTIVE_SESSION_FILE_PATH = keyToFilename(
  LEGACY_ACTIVE_SESSION_STORAGE_KEY
)

const SOURCE_PRIORITY = Object.freeze({
  canonical: 0,
  'legacy-active-file': 1,
  'handoff-persisted': 2,
  'legacy-runtime-storage': 3,
  'handoff-runtime': 4
})

const ACTIVE_TEAM = 'teamA'
const OPPOSING_TEAM = 'teamB'

/**
 * @returns {ActiveSession | null}
 */
export function getActiveSession() {
  const canonicalSession = loadSessionFromPath(
    ACTIVE_SESSION_FILE_PATH,
    'canonical',
    false
  )

  if (canonicalSession) {
    return canonicalSession
  }

  const legacyActiveSession = loadSessionFromPath(
    LEGACY_ACTIVE_SESSION_FILE_PATH,
    'legacy-active-file',
    true
  )

  if (legacyActiveSession) {
    return legacyActiveSession
  }

  return normalizeLegacyRuntimeState(loadLegacyActiveSession())
}

/**
 * @param {ActiveSession} session
 * @param {{ preserveUpdatedAt?: boolean }} [options]
 * @returns {boolean}
 */
export function saveActiveSession(session, options = {}) {
  if (!isMatchState(session)) {
    log('warn', 'refusing to save invalid active session')
    return false
  }

  if (!isHmFsAvailable()) {
    return false
  }

  const nextSession = {
    ...session,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt:
      options.preserveUpdatedAt === true
        ? toNonNegativeInteger(session.updatedAt, Date.now())
        : Date.now()
  }

  const payload = serializeMatchState(nextSession)

  if (!writeTextFile(ACTIVE_SESSION_FILE_PATH, payload)) {
    log('warn', 'failed to persist active session to canonical path', {
      path: ACTIVE_SESSION_FILE_PATH
    })
    return false
  }

  return true
}

/**
 * @returns {boolean}
 */
export function clearActiveSession() {
  if (!isHmFsAvailable()) {
    return false
  }

  const didClearCanonical = removeFile(ACTIVE_SESSION_FILE_PATH)
  const didClearLegacyActiveFile = removeFile(LEGACY_ACTIVE_SESSION_FILE_PATH)

  if (!didClearCanonical) {
    log('warn', 'failed to clear canonical active session path', {
      path: ACTIVE_SESSION_FILE_PATH
    })
  }

  if (!didClearLegacyActiveFile) {
    log('warn', 'failed to clear legacy active-session path', {
      path: LEGACY_ACTIVE_SESSION_FILE_PATH
    })
  }

  return didClearCanonical && didClearLegacyActiveFile
}

/**
 * @param {{
 *   globalData?: Record<string, unknown>,
 *   pendingPersistedMatchState?: unknown,
 *   pendingRuntimeMatchState?: unknown,
 *   sessionHandoff?: unknown
 * }} [options]
 * @returns {LegacyMigrationResult}
 */
export function migrateLegacySessions(options = {}) {
  const candidates = []
  const canonicalCandidate = loadSessionCandidate(
    ACTIVE_SESSION_FILE_PATH,
    'canonical',
    false
  )
  const legacyActiveCandidate = loadSessionCandidate(
    LEGACY_ACTIVE_SESSION_FILE_PATH,
    'legacy-active-file',
    true
  )
  const legacyRuntimeCandidate = createRuntimeCandidate(
    loadLegacyActiveSession(),
    'legacy-runtime-storage'
  )

  if (canonicalCandidate) {
    candidates.push(canonicalCandidate)
  }
  if (legacyActiveCandidate) {
    candidates.push(legacyActiveCandidate)
  }
  if (legacyRuntimeCandidate) {
    candidates.push(legacyRuntimeCandidate)
  }

  const globalData = isRecord(options.globalData) ? options.globalData : null

  const handoffPersistedCandidate = createPersistedCandidate(
    options.pendingPersistedMatchState ??
      globalData?.pendingPersistedMatchState,
    'handoff-persisted'
  )
  const handoffRuntimeCandidate = createRuntimeCandidate(
    options.pendingRuntimeMatchState ?? globalData?.pendingHomeMatchState,
    'handoff-runtime'
  )
  const sessionHandoffCandidate = createPersistedCandidate(
    options.sessionHandoff ?? globalData?.sessionHandoff,
    'handoff-persisted'
  )

  if (handoffPersistedCandidate) {
    candidates.push(handoffPersistedCandidate)
  }
  if (handoffRuntimeCandidate) {
    candidates.push(handoffRuntimeCandidate)
  }
  if (sessionHandoffCandidate) {
    candidates.push(sessionHandoffCandidate)
  }

  const bestCandidate = pickMostRecentCandidate(candidates)

  if (!bestCandidate) {
    log('debug', 'no migratable legacy session found')
    return {
      migrated: false,
      source: null,
      didCleanupLegacy: false,
      reason: 'no-legacy-session'
    }
  }

  const shouldWriteCanonical =
    !canonicalCandidate ||
    bestCandidate.source !== 'canonical' ||
    !areSessionsEquivalent(canonicalCandidate.session, bestCandidate.session)

  if (shouldWriteCanonical) {
    const didSaveCanonical = saveActiveSession(bestCandidate.session, {
      preserveUpdatedAt: true
    })

    if (!didSaveCanonical) {
      return {
        migrated: false,
        source: bestCandidate.source,
        didCleanupLegacy: false,
        reason: 'canonical-write-failed'
      }
    }

    log('info', 'migrated active session into canonical path', {
      source: bestCandidate.source,
      updatedAt: bestCandidate.updatedAt
    })
  } else {
    log('debug', 'canonical active session already up-to-date')
  }

  const didCleanupLegacy = cleanupLegacyArtifacts(globalData)

  return {
    migrated: shouldWriteCanonical,
    source: bestCandidate.source,
    didCleanupLegacy,
    reason: null
  }
}

/**
 * @param {string} path
 * @param {string} source
 * @param {boolean} allowLegacyRuntimeFallback
 * @returns {ActiveSession | null}
 */
function loadSessionFromPath(path, source, allowLegacyRuntimeFallback) {
  const serialized = readTextFile(path)

  if (serialized === null) {
    return null
  }

  return deserializeSession(serialized, source, allowLegacyRuntimeFallback)
}

/**
 * @param {string} path
 * @param {string} source
 * @param {boolean} allowLegacyRuntimeFallback
 * @returns {{ source: string, session: ActiveSession, updatedAt: number } | null}
 */
function loadSessionCandidate(path, source, allowLegacyRuntimeFallback) {
  const session = loadSessionFromPath(path, source, allowLegacyRuntimeFallback)

  if (!session) {
    return null
  }

  return {
    source,
    session,
    updatedAt: toNonNegativeInteger(session.updatedAt, 0)
  }
}

/**
 * @param {unknown} value
 * @param {string} source
 * @returns {{ source: string, session: ActiveSession, updatedAt: number } | null}
 */
function createPersistedCandidate(value, source) {
  if (!isRecord(value)) {
    return null
  }

  if (!isMatchState(value)) {
    return null
  }

  return {
    source,
    session: withHistoryCompatibilityMetadata(value, value),
    updatedAt: toNonNegativeInteger(value.updatedAt, 0)
  }
}

/**
 * @param {unknown} value
 * @param {string} source
 * @returns {{ source: string, session: ActiveSession, updatedAt: number } | null}
 */
function createRuntimeCandidate(value, source) {
  const session = normalizeLegacyRuntimeState(value)

  if (!session) {
    return null
  }

  return {
    source,
    session,
    updatedAt: toNonNegativeInteger(session.updatedAt, 0)
  }
}

/**
 * @param {Array<{ source: string, session: ActiveSession, updatedAt: number }>} candidates
 * @returns {{ source: string, session: ActiveSession, updatedAt: number } | null}
 */
function pickMostRecentCandidate(candidates) {
  let bestCandidate = null

  for (const candidate of candidates) {
    if (!bestCandidate) {
      bestCandidate = candidate
      continue
    }

    if (candidate.updatedAt > bestCandidate.updatedAt) {
      bestCandidate = candidate
      continue
    }

    if (candidate.updatedAt < bestCandidate.updatedAt) {
      continue
    }

    const candidatePriority =
      SOURCE_PRIORITY[candidate.source] ?? Number.MAX_SAFE_INTEGER
    const bestCandidatePriority =
      SOURCE_PRIORITY[bestCandidate.source] ?? Number.MAX_SAFE_INTEGER

    if (candidatePriority < bestCandidatePriority) {
      bestCandidate = candidate
    }
  }

  return bestCandidate
}

/**
 * @param {ActiveSession} leftSession
 * @param {ActiveSession} rightSession
 * @returns {boolean}
 */
function areSessionsEquivalent(leftSession, rightSession) {
  try {
    return JSON.stringify(leftSession) === JSON.stringify(rightSession)
  } catch {
    return false
  }
}

/**
 * @param {string} serialized
 * @param {string} source
 * @param {boolean} allowLegacyRuntimeFallback
 * @returns {ActiveSession | null}
 */
function deserializeSession(serialized, source, allowLegacyRuntimeFallback) {
  if (typeof serialized !== 'string' || serialized.length === 0) {
    return null
  }

  try {
    const parsed = JSON.parse(serialized)

    if (isMatchState(parsed)) {
      return withHistoryCompatibilityMetadata(parsed, parsed)
    }

    if (looksLikeCanonicalV0State(parsed)) {
      const migratedState = migrateMatchState(parsed)

      if (isMatchState(migratedState)) {
        return withHistoryCompatibilityMetadata(migratedState, parsed)
      }

      return null
    }

    if (allowLegacyRuntimeFallback) {
      return normalizeLegacyRuntimeState(parsed)
    }

    return null
  } catch {
    log('debug', 'failed to deserialize active session payload', { source })
    return null
  }
}

/**
 * @param {unknown} runtimeState
 * @returns {ActiveSession | null}
 */
function normalizeLegacyRuntimeState(runtimeState) {
  if (!looksLikeLegacyRuntimeState(runtimeState)) {
    return null
  }

  const { setsToPlay, setsNeededToWin } = resolveSetConfiguration(
    runtimeState.setsToPlay,
    runtimeState.setsNeededToWin
  )

  const normalizedSession = {
    status:
      runtimeState.status === MATCH_STATUS.FINISHED
        ? MATCH_STATUS.FINISHED
        : MATCH_STATUS.ACTIVE,
    setsToPlay,
    setsNeededToWin,
    setsWon: {
      teamA: toNonNegativeInteger(runtimeState?.setsWon?.teamA, 0),
      teamB: toNonNegativeInteger(runtimeState?.setsWon?.teamB, 0)
    },
    currentSet: {
      number: toPositiveInteger(
        runtimeState?.currentSetStatus?.number,
        toPositiveInteger(runtimeState?.currentSet, 1)
      ),
      games: {
        teamA: toNonNegativeInteger(
          runtimeState?.currentSetStatus?.teamAGames,
          toNonNegativeInteger(runtimeState?.teamA?.games, 0)
        ),
        teamB: toNonNegativeInteger(
          runtimeState?.currentSetStatus?.teamBGames,
          toNonNegativeInteger(runtimeState?.teamB?.games, 0)
        )
      }
    },
    currentGame: {
      points: {
        teamA: toPersistedPointValue(runtimeState?.teamA?.points),
        teamB: toPersistedPointValue(runtimeState?.teamB?.points)
      }
    },
    setHistory: normalizeSetHistory(runtimeState?.setHistory),
    updatedAt: toNonNegativeInteger(runtimeState.updatedAt, Date.now()),
    schemaVersion: CURRENT_SCHEMA_VERSION
  }

  if (!isMatchState(normalizedSession)) {
    return null
  }

  return withHistoryCompatibilityMetadata(normalizedSession, runtimeState)
}

/**
 * @param {unknown} setHistory
 * @returns {Array<{ setNumber: number, teamAGames: number, teamBGames: number }>}
 */
function normalizeSetHistory(setHistory) {
  if (!Array.isArray(setHistory)) {
    return []
  }

  return setHistory
    .map((entry, index) => ({
      setNumber: toPositiveInteger(entry?.setNumber, index + 1),
      teamAGames: toNonNegativeInteger(entry?.teamAGames, 0),
      teamBGames: toNonNegativeInteger(entry?.teamBGames, 0)
    }))
    .sort((leftEntry, rightEntry) => leftEntry.setNumber - rightEntry.setNumber)
}

/**
 * @param {unknown} setsToPlay
 * @param {unknown} setsNeededToWin
 * @returns {{ setsToPlay: import('./match-state-schema.js').SetsToPlay, setsNeededToWin: import('./match-state-schema.js').SetsNeededToWin }}
 */
function resolveSetConfiguration(setsToPlay, setsNeededToWin) {
  const normalizedSetsToPlay =
    setsToPlay === SETS_TO_PLAY.ONE ||
    setsToPlay === SETS_TO_PLAY.THREE ||
    setsToPlay === SETS_TO_PLAY.FIVE
      ? setsToPlay
      : null

  const normalizedSetsNeededToWin =
    setsNeededToWin === SETS_NEEDED_TO_WIN.ONE ||
    setsNeededToWin === SETS_NEEDED_TO_WIN.TWO ||
    setsNeededToWin === SETS_NEEDED_TO_WIN.THREE
      ? setsNeededToWin
      : null

  if (
    normalizedSetsToPlay === SETS_TO_PLAY.ONE &&
    normalizedSetsNeededToWin === SETS_NEEDED_TO_WIN.ONE
  ) {
    return {
      setsToPlay: SETS_TO_PLAY.ONE,
      setsNeededToWin: SETS_NEEDED_TO_WIN.ONE
    }
  }

  if (
    normalizedSetsToPlay === SETS_TO_PLAY.THREE &&
    normalizedSetsNeededToWin === SETS_NEEDED_TO_WIN.TWO
  ) {
    return {
      setsToPlay: SETS_TO_PLAY.THREE,
      setsNeededToWin: SETS_NEEDED_TO_WIN.TWO
    }
  }

  if (
    normalizedSetsToPlay === SETS_TO_PLAY.FIVE &&
    normalizedSetsNeededToWin === SETS_NEEDED_TO_WIN.THREE
  ) {
    return {
      setsToPlay: SETS_TO_PLAY.FIVE,
      setsNeededToWin: SETS_NEEDED_TO_WIN.THREE
    }
  }

  if (normalizedSetsNeededToWin === SETS_NEEDED_TO_WIN.ONE) {
    return {
      setsToPlay: SETS_TO_PLAY.ONE,
      setsNeededToWin: SETS_NEEDED_TO_WIN.ONE
    }
  }

  if (normalizedSetsNeededToWin === SETS_NEEDED_TO_WIN.THREE) {
    return {
      setsToPlay: SETS_TO_PLAY.FIVE,
      setsNeededToWin: SETS_NEEDED_TO_WIN.THREE
    }
  }

  if (normalizedSetsToPlay === SETS_TO_PLAY.ONE) {
    return {
      setsToPlay: SETS_TO_PLAY.ONE,
      setsNeededToWin: SETS_NEEDED_TO_WIN.ONE
    }
  }

  if (normalizedSetsToPlay === SETS_TO_PLAY.FIVE) {
    return {
      setsToPlay: SETS_TO_PLAY.FIVE,
      setsNeededToWin: SETS_NEEDED_TO_WIN.THREE
    }
  }

  return {
    setsToPlay: SETS_TO_PLAY.THREE,
    setsNeededToWin: SETS_NEEDED_TO_WIN.TWO
  }
}

/**
 * @param {unknown} point
 * @returns {number}
 */
function toPersistedPointValue(point) {
  if (point === 'Ad') {
    return 50
  }

  if (point === 'Game') {
    return 60
  }

  return toNonNegativeInteger(point, 0)
}

/**
 * @param {ActiveSession} session
 * @param {unknown} source
 * @returns {ActiveSession}
 */
function withHistoryCompatibilityMetadata(session, source) {
  const nextSession = {
    ...session
  }

  if (!isRecord(source)) {
    return nextSession
  }

  const teamALabel = source?.teams?.teamA?.label
  const teamBLabel = source?.teams?.teamB?.label

  if (typeof teamALabel === 'string' && typeof teamBLabel === 'string') {
    nextSession.teams = {
      teamA: {
        id: ACTIVE_TEAM,
        label: teamALabel
      },
      teamB: {
        id: OPPOSING_TEAM,
        label: teamBLabel
      }
    }
  }

  if (
    source.winnerTeam === ACTIVE_TEAM ||
    source.winnerTeam === OPPOSING_TEAM
  ) {
    nextSession.winnerTeam = source.winnerTeam
  }

  if (isRecord(source.winner) && isValidWinnerTeam(source.winner.team)) {
    nextSession.winner = {
      team: source.winner.team
    }
  }

  if (Number.isInteger(source.completedAt) && source.completedAt >= 0) {
    nextSession.completedAt = source.completedAt
  }

  return nextSession
}

/**
 * @param {Record<string, unknown> | null} globalData
 * @returns {boolean}
 */
function cleanupLegacyArtifacts(globalData) {
  let didCleanup = true

  try {
    clearLegacyActiveSession()
  } catch {
    log('warn', 'failed to clear legacy runtime storage key', {
      key: LEGACY_RUNTIME_STORAGE_KEY
    })
    didCleanup = false
  }

  if (!removeFile(LEGACY_ACTIVE_SESSION_FILE_PATH)) {
    log('warn', 'failed to clear legacy active-session file path', {
      path: LEGACY_ACTIVE_SESSION_FILE_PATH
    })
    didCleanup = false
  }

  if (globalData) {
    delete globalData.pendingPersistedMatchState
    delete globalData.pendingHomeMatchState
    delete globalData.sessionHandoff
  }

  return didCleanup
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function looksLikeCanonicalV0State(value) {
  return (
    isRecord(value) &&
    (value.schemaVersion === 0 || !Object.hasOwn(value, 'schemaVersion')) &&
    Object.hasOwn(value, 'status') &&
    Object.hasOwn(value, 'setsToPlay') &&
    Object.hasOwn(value, 'setsNeededToWin') &&
    Object.hasOwn(value, 'setsWon') &&
    Object.hasOwn(value, 'currentSet') &&
    Object.hasOwn(value, 'currentGame') &&
    Object.hasOwn(value, 'setHistory') &&
    Object.hasOwn(value, 'updatedAt')
  )
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function looksLikeLegacyRuntimeState(value) {
  return (
    isRecord(value) &&
    isRecord(value.teamA) &&
    isRecord(value.teamB) &&
    isRecord(value.currentSetStatus) &&
    (value.status === MATCH_STATUS.ACTIVE ||
      value.status === MATCH_STATUS.FINISHED)
  )
}

/**
 * @param {unknown} value
 * @returns {value is 'teamA' | 'teamB'}
 */
function isValidWinnerTeam(value) {
  return value === ACTIVE_TEAM || value === OPPOSING_TEAM
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function toNonNegativeInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function toPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

/**
 * @returns {boolean}
 */
function isHmFsAvailable() {
  return (
    typeof hmFS !== 'undefined' &&
    typeof hmFS.open === 'function' &&
    typeof hmFS.close === 'function' &&
    typeof hmFS.read === 'function' &&
    typeof hmFS.write === 'function' &&
    typeof hmFS.stat === 'function'
  )
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function resolveFilePath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return ''
  }

  if (filePath.startsWith('data://')) {
    return filePath.slice('data://'.length)
  }

  if (filePath.startsWith('/data/')) {
    return filePath.slice('/data/'.length)
  }

  return filePath
}

/**
 * @param {string} filePath
 * @returns {string | null}
 */
function readTextFile(filePath) {
  if (!isHmFsAvailable()) {
    return null
  }

  const resolvedPath = resolveFilePath(filePath)
  let fileDescriptor = -1

  try {
    const [statInfo, statError] = hmFS.stat(resolvedPath)

    if (statError !== 0 || !statInfo || statInfo.size <= 0) {
      return null
    }

    const readFlag =
      typeof hmFS.O_RDONLY === 'number' ? hmFS.O_RDONLY : FS_O_RDONLY
    fileDescriptor = hmFS.open(resolvedPath, readFlag)

    if (fileDescriptor < 0) {
      return null
    }

    const buffer = new Uint8Array(statInfo.size)
    const readResult = hmFS.read(
      fileDescriptor,
      buffer.buffer,
      0,
      statInfo.size
    )

    if (readResult < 0) {
      return null
    }

    const decoded = decodeUtf8(buffer)
    return decoded.length > 0 ? decoded : null
  } catch {
    return null
  } finally {
    if (fileDescriptor >= 0) {
      try {
        hmFS.close(fileDescriptor)
      } catch {
        // Ignore close failures.
      }
    }
  }
}

/**
 * @param {string} filePath
 * @param {string} content
 * @returns {boolean}
 */
function writeTextFile(filePath, content) {
  if (!isHmFsAvailable()) {
    return false
  }

  const resolvedPath = resolveFilePath(filePath)
  let fileDescriptor = -1

  try {
    const bytes = encodeUtf8(content)
    const writeFlags =
      (typeof hmFS.O_WRONLY === 'number' ? hmFS.O_WRONLY : FS_O_WRONLY) |
      (typeof hmFS.O_CREAT === 'number' ? hmFS.O_CREAT : FS_O_CREAT) |
      (typeof hmFS.O_TRUNC === 'number' ? hmFS.O_TRUNC : FS_O_TRUNC)

    fileDescriptor = hmFS.open(resolvedPath, writeFlags)

    if (fileDescriptor < 0) {
      return false
    }

    const writeResult = hmFS.write(
      fileDescriptor,
      bytes.buffer,
      0,
      bytes.length
    )
    return writeResult >= 0
  } catch {
    return false
  } finally {
    if (fileDescriptor >= 0) {
      try {
        hmFS.close(fileDescriptor)
      } catch {
        // Ignore close failures.
      }
    }
  }
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function removeFile(filePath) {
  if (!isHmFsAvailable()) {
    return false
  }

  const resolvedPath = resolveFilePath(filePath)

  try {
    const [statInfo, statError] = hmFS.stat(resolvedPath)

    if (statError !== 0 || !statInfo) {
      return true
    }

    const removeResult = hmFS.remove(resolvedPath)
    return removeResult === undefined || removeResult >= 0
  } catch {
    return false
  }
}

/**
 * @param {'debug' | 'info' | 'warn'} level
 * @param {string} message
 * @param {Record<string, unknown>} [context]
 */
function log(level, message, context = {}) {
  if (typeof console === 'undefined') {
    return
  }

  const text = `${LOG_PREFIX} ${message}`

  if (level === 'warn' && typeof console.warn === 'function') {
    console.warn(text, context)
    return
  }

  if (level === 'info' && typeof console.info === 'function') {
    console.info(text, context)
    return
  }

  if (level === 'debug' && typeof console.debug === 'function') {
    console.debug(text, context)
    return
  }

  if (typeof console.log === 'function') {
    console.log(text, context)
  }
}

/**
 * @param {string} str
 * @returns {Uint8Array}
 */
function encodeUtf8(str) {
  const bytes = []

  for (let i = 0; i < str.length; i += 1) {
    let code = str.charCodeAt(i)

    if (code >= 0xd800 && code <= 0xdbff) {
      const high = code
      const low = str.charCodeAt(i + 1)

      if (low >= 0xdc00 && low <= 0xdfff) {
        code = ((high - 0xd800) << 10) + (low - 0xdc00) + 0x10000
        i += 1
      }
    }

    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      )
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      )
    }
  }

  return new Uint8Array(bytes)
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function decodeUtf8(bytes) {
  let decoded = ''
  let index = 0

  while (index < bytes.length) {
    const byte = bytes[index]
    let code

    if (byte < 0x80) {
      code = byte
      index += 1
    } else if ((byte & 0xe0) === 0xc0) {
      code = ((byte & 0x1f) << 6) | (bytes[index + 1] & 0x3f)
      index += 2
    } else if ((byte & 0xf0) === 0xe0) {
      code =
        ((byte & 0x0f) << 12) |
        ((bytes[index + 1] & 0x3f) << 6) |
        (bytes[index + 2] & 0x3f)
      index += 3
    } else {
      code =
        ((byte & 0x07) << 18) |
        ((bytes[index + 1] & 0x3f) << 12) |
        ((bytes[index + 2] & 0x3f) << 6) |
        (bytes[index + 3] & 0x3f)
      index += 4
    }

    if (code >= 0x10000) {
      const offset = code - 0x10000
      decoded += String.fromCharCode(
        0xd800 + (offset >> 10),
        0xdc00 + (offset & 0x3ff)
      )
      continue
    }

    decoded += String.fromCharCode(code)
  }

  return decoded
}

/**
 * @param {string} key
 * @returns {string}
 */
function keyToFilename(key) {
  return `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`
}
