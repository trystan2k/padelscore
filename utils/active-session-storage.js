import {
  CURRENT_SCHEMA_VERSION,
  deserializeMatchSession,
  isMatchState,
  STORAGE_KEY as LEGACY_ACTIVE_SESSION_STORAGE_KEY,
  MATCH_STATUS,
  migrateMatchState,
  readTimestampCandidate,
  SETS_NEEDED_TO_WIN,
  SETS_TO_PLAY,
  serializeMatchState,
  toIsoTimestampSafe
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
 *   completedAt?: number,
 *   createdAt?: string | number,
 *   created_at?: string | number,
 *   startedAt?: string | number,
 *   started_at?: string | number,
 *   startTime?: string | number,
 *   start_time?: string | number,
 *   matchStartTime?: string | number,
 *   match_start_time?: string | number
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
  'legacy-runtime-storage': 2
})

const ACTIVE_TEAM = 'teamA'
const OPPOSING_TEAM = 'teamB'
let isAtomicUpdateInFlight = false

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
 * @param {{ preserveUpdatedAt?: boolean, allowStartTimeRepair?: boolean }} [options]
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

  const updatedAt =
    options.preserveUpdatedAt === true
      ? toNonNegativeInteger(session.updatedAt, Date.now())
      : Date.now()

  const existingCanonicalSession = loadSessionFromPath(
    ACTIVE_SESSION_FILE_PATH,
    'canonical',
    false
  )

  const nextSession = applySessionWriteNormalization({
    session,
    existingCanonicalSession,
    updatedAt,
    allowStartTimeRepair: options.allowStartTimeRepair === true
  })

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
 * @param {{
 *   session: ActiveSession,
 *   existingCanonicalSession: ActiveSession | null,
 *   updatedAt: number,
 *   allowStartTimeRepair: boolean
 * }} params
 * @returns {ActiveSession}
 */
function applySessionWriteNormalization(params) {
  const updatedAt = toNonNegativeInteger(params.updatedAt, Date.now())
  const updatedAtIso = toIsoTimestampSafe(updatedAt)

  const existingTiming = isRecord(params.existingCanonicalSession?.timing)
    ? params.existingCanonicalSession.timing
    : null
  const sessionTiming = isRecord(params.session?.timing)
    ? params.session.timing
    : null

  const createdAtTimestamp =
    readTimestampCandidate(sessionTiming?.createdAt) ??
    readTimestampCandidate(existingTiming?.createdAt) ??
    readTimestampCandidate(params.session?.createdAt) ??
    readTimestampCandidate(params.session?.created_at) ??
    updatedAt

  const existingStartedAtTimestamp = readTimestampCandidate(
    existingTiming?.startedAt
  )
  const requestedStartedAtTimestamp = readPreferredStartTimestamp(
    params.session,
    sessionTiming
  )

  let nextStartedAtTimestamp = requestedStartedAtTimestamp

  if (
    existingStartedAtTimestamp !== null &&
    params.allowStartTimeRepair !== true
  ) {
    nextStartedAtTimestamp = existingStartedAtTimestamp

    if (
      requestedStartedAtTimestamp !== null &&
      requestedStartedAtTimestamp !== existingStartedAtTimestamp
    ) {
      log('warn', 'ignored attempt to overwrite match start time', {
        previousStartedAt: toIsoTimestampSafe(existingStartedAtTimestamp),
        requestedStartedAt: toIsoTimestampSafe(requestedStartedAtTimestamp)
      })
    }
  }

  if (nextStartedAtTimestamp === null) {
    nextStartedAtTimestamp = createdAtTimestamp
    log('info', 'derived missing match start time from created_at semantics')
  }

  const finishedAt =
    params.session.status === MATCH_STATUS.FINISHED
      ? toIsoTimestampSafe(
          readTimestampCandidate(sessionTiming?.finishedAt) ?? updatedAt
        )
      : null

  return {
    ...params.session,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt,
    timing: {
      ...(sessionTiming ?? {}),
      createdAt: toIsoTimestampSafe(createdAtTimestamp),
      updatedAt: updatedAtIso,
      startedAt: toIsoTimestampSafe(nextStartedAtTimestamp),
      finishedAt
    }
  }
}

/**
 * @param {(session: ActiveSession) => ActiveSession | null | void} updaterFn
 * @param {{ preserveUpdatedAt?: boolean, allowStartTimeRepair?: boolean }} [options]
 * @returns {ActiveSession | null}
 */
export function updateActiveSession(updaterFn, options = {}) {
  if (typeof updaterFn !== 'function') {
    log('warn', 'refusing to update active session with non-function updater')
    return null
  }

  return withAtomicUpdateLock(() => {
    const currentSession = getActiveSession()

    if (!currentSession) {
      return null
    }

    const currentSnapshot = cloneSession(currentSession)

    if (!currentSnapshot) {
      return null
    }

    let updaterResult

    try {
      updaterResult = updaterFn(currentSnapshot)
    } catch {
      log('warn', 'active session updater threw')
      return null
    }

    if (updaterResult === null) {
      return null
    }

    const nextSession =
      typeof updaterResult === 'undefined' ? currentSnapshot : updaterResult

    if (!isMatchState(nextSession)) {
      log('warn', 'active session updater returned invalid state')
      return null
    }

    const persistedSnapshot = cloneSession(nextSession)

    if (!persistedSnapshot) {
      return null
    }

    if (!saveActiveSession(persistedSnapshot, options)) {
      return null
    }

    return getActiveSession()
  })
}

/**
 * @param {Partial<ActiveSession>} patch
 * @param {{ preserveUpdatedAt?: boolean, allowStartTimeRepair?: boolean }} [options]
 * @returns {ActiveSession | null}
 */
export function updateActiveSessionPartial(patch, options = {}) {
  if (!isRecord(patch)) {
    log('warn', 'refusing to apply non-object active session patch')
    return null
  }

  const patchSnapshot = cloneSession(patch)

  if (!isRecord(patchSnapshot)) {
    return null
  }

  return updateActiveSession(
    (session) => ({
      ...session,
      ...patchSnapshot
    }),
    options
  )
}

/**
 * @returns {boolean}
 */
export function clearActiveSession() {
  let didClearLegacyRuntime = true

  try {
    clearLegacyActiveSession()
  } catch {
    log('warn', 'failed to clear legacy runtime storage key', {
      key: LEGACY_RUNTIME_STORAGE_KEY
    })
    didClearLegacyRuntime = false
  }

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

  return didClearCanonical && didClearLegacyActiveFile && didClearLegacyRuntime
}

/**
 * @returns {LegacyMigrationResult}
 */
export function migrateLegacySessions() {
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
      preserveUpdatedAt: true,
      allowStartTimeRepair: true
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

  const didCleanupLegacy = cleanupLegacyArtifacts()

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

    const canonicalSession = deserializeMatchSession(serialized)

    if (canonicalSession) {
      return withHistoryCompatibilityMetadata(canonicalSession, parsed)
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
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timing: runtimeState?.timing,
    createdAt: runtimeState?.createdAt,
    created_at: runtimeState?.created_at,
    startedAt: runtimeState?.startedAt,
    started_at: runtimeState?.started_at,
    startTime: runtimeState?.startTime,
    start_time: runtimeState?.start_time,
    matchStartTime: runtimeState?.matchStartTime,
    match_start_time: runtimeState?.match_start_time
  }

  const migratedSession = migrateMatchState(normalizedSession)

  if (!isMatchState(migratedSession)) {
    return null
  }

  return withHistoryCompatibilityMetadata(migratedSession, runtimeState)
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
 * @returns {boolean}
 */
function cleanupLegacyArtifacts() {
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

  return didCleanup
}

/**
 * @param {() => ActiveSession | null} callback
 * @returns {ActiveSession | null}
 */
function withAtomicUpdateLock(callback) {
  if (isAtomicUpdateInFlight) {
    log('warn', 'atomic active session update skipped due to in-flight update')
    return null
  }

  isAtomicUpdateInFlight = true

  try {
    return callback()
  } finally {
    isAtomicUpdateInFlight = false
  }
}

/**
 * @template T
 * @param {T} value
 * @returns {T | null}
 */
function cloneSession(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
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
function looksLikeLegacyRuntimeState(value) {
  return (
    isRecord(value) &&
    isRecord(value.teamA) &&
    isRecord(value.teamB) &&
    isRecord(value.currentSetStatus) &&
    hasLegacyRuntimeScoreShape(value) &&
    (value.status === MATCH_STATUS.ACTIVE ||
      value.status === MATCH_STATUS.FINISHED)
  )
}

/**
 * @param {Record<string, any>} value
 * @returns {boolean}
 */
function hasLegacyRuntimeScoreShape(value) {
  return (
    isRecord(value.setsWon) &&
    isNonNegativeInteger(value.setsWon.teamA) &&
    isNonNegativeInteger(value.setsWon.teamB) &&
    isPositiveInteger(value.currentSetStatus.number) &&
    isNonNegativeInteger(value.currentSetStatus.teamAGames) &&
    isNonNegativeInteger(value.currentSetStatus.teamBGames) &&
    isLegacyPointValue(value.teamA.points) &&
    isLegacyPointValue(value.teamB.points)
  )
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isLegacyPointValue(value) {
  return value === 'Ad' || value === 'Game' || isNonNegativeInteger(value)
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
 * @returns {boolean}
 */
function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
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
 * @param {ActiveSession} session
 * @param {Record<string, any> | null} sessionTiming
 * @returns {number | null}
 */
function readPreferredStartTimestamp(session, sessionTiming) {
  let earliestTimestamp = null

  const candidates = [
    sessionTiming?.startedAt,
    session?.matchStartTime,
    session?.match_start_time,
    session?.startedAt,
    session?.started_at,
    session?.startTime,
    session?.start_time
  ]

  for (const candidateValue of candidates) {
    const candidateTimestamp = readTimestampCandidate(candidateValue)

    if (candidateTimestamp === null) {
      continue
    }

    if (earliestTimestamp === null || candidateTimestamp < earliestTimestamp) {
      earliestTimestamp = candidateTimestamp
    }
  }

  return earliestTimestamp
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
