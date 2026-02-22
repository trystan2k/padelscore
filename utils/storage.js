import { MATCH_STATUS } from './match-state.js'
import { SCORE_POINT_SEQUENCE } from './scoring-constants.js'

export const MATCH_STATE_STORAGE_KEY = 'padel-score.match-state'

const scorePointSet = new Set(SCORE_POINT_SEQUENCE)
const fallbackStorage = createInMemoryStorageAdapter()

/**
 * @returns {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null | undefined), removeItem: (key: string) => void }}
 */
function getSettingsStorage() {
  const runtimeStorage = resolveRuntimeStorage()

  if (runtimeStorage) {
    return createStorageAdapter(runtimeStorage)
  }

  return fallbackStorage
}

/**
 * @param {import('./match-state.js').MatchState} state
 */
export function saveState(state) {
  const serializedState = JSON.stringify(state)
  getSettingsStorage().setItem(MATCH_STATE_STORAGE_KEY, serializedState)
}

/**
 * @returns {import('./match-state.js').MatchState | null}
 */
export function loadState() {
  const serializedState = getSettingsStorage().getItem(MATCH_STATE_STORAGE_KEY)

  if (!serializedState) {
    return null
  }

  try {
    const parsedState = JSON.parse(serializedState)
    return isMatchState(parsedState) ? parsedState : null
  } catch {
    return null
  }
}

export function clearState() {
  getSettingsStorage().removeItem(MATCH_STATE_STORAGE_KEY)
}

/**
 * Returns a storage adapter backed by hmFS.SysProSetChars / SysProGetChars
 * which is the correct key-value string storage API for Zepp OS 1.0 device apps.
 *
 * @returns {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null), removeItem: (key: string) => void } | null}
 */
function resolveRuntimeStorage() {
  if (typeof hmFS !== 'undefined' && typeof hmFS.SysProSetChars === 'function' && typeof hmFS.SysProGetChars === 'function') {
    return createHmFsStorageAdapter()
  }

  return null
}

/**
 * Wraps hmFS.SysProSetChars / SysProGetChars into a setItem/getItem/removeItem adapter.
 * SysProSetChars persists across page transitions but clears on system reboot.
 *
 * @returns {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null), removeItem: (key: string) => void }}
 */
function createHmFsStorageAdapter() {
  return {
    setItem(key, value) {
      try {
        hmFS.SysProSetChars(key, value)
      } catch {
        // Ignore storage write errors so app runtime does not crash.
      }
    },
    getItem(key) {
      try {
        const value = hmFS.SysProGetChars(key)
        return typeof value === 'string' && value.length > 0 ? value : null
      } catch {
        return null
      }
    },
    removeItem(key) {
      try {
        hmFS.SysProSetChars(key, '')
      } catch {
        // Ignore storage delete errors so app runtime does not crash.
      }
    }
  }
}

/**
 * @param {{ setItem?: (key: string, value: string) => void, getItem?: (key: string) => (string | null | undefined), removeItem?: (key: string) => void }} storage
 * @returns {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null), removeItem: (key: string) => void }}
 */
function createStorageAdapter(storage) {
  return {
    setItem(key, value) {
      if (typeof storage.setItem !== 'function') {
        return
      }

      try {
        storage.setItem(key, value)
      } catch {
        // Ignore storage write errors so app runtime does not crash.
      }
    },
    getItem(key) {
      if (typeof storage.getItem !== 'function') {
        return null
      }

      try {
        const value = storage.getItem(key)

        if (typeof value === 'string') {
          return value
        }

        return value == null ? null : String(value)
      } catch {
        return null
      }
    },
    removeItem(key) {
      if (typeof storage.removeItem === 'function') {
        try {
          storage.removeItem(key)
        } catch {
          // Ignore storage delete errors so app runtime does not crash.
        }

        return
      }

      if (typeof storage.setItem === 'function') {
        try {
          storage.setItem(key, '')
        } catch {
          // Ignore storage fallback delete errors so app runtime does not crash.
        }
      }
    }
  }
}

/**
 * @returns {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null), removeItem: (key: string) => void }}
 */
function createInMemoryStorageAdapter() {
  const memoryStorage = new Map()

  return {
    setItem(key, value) {
      memoryStorage.set(key, value)
    },
    getItem(key) {
      return memoryStorage.has(key) ? memoryStorage.get(key) : null
    },
    removeItem(key) {
      memoryStorage.delete(key)
    }
  }
}

/**
 * @param {unknown} value
 * @returns {value is import('./match-state.js').MatchState}
 */
function isMatchState(value) {
  if (!isRecord(value)) {
    return false
  }

  return (
    isMatchTeamConfiguration(value.teams) &&
    isTeamScore(value.teamA) &&
    isTeamScore(value.teamB) &&
    isCurrentSetStatus(value.currentSetStatus) &&
    isNonNegativeInteger(value.currentSet) &&
    isMatchStatus(value.status) &&
    isFiniteNumber(value.updatedAt)
  )
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
 * @returns {value is import('./match-state.js').TeamScore}
 */
function isTeamScore(value) {
  return (
    isRecord(value) &&
    scorePointSet.has(value.points) &&
    isNonNegativeInteger(value.games)
  )
}

/**
 * @param {unknown} value
 * @returns {value is import('./match-state.js').MatchTeamConfiguration}
 */
function isMatchTeamConfiguration(value) {
  return (
    isRecord(value) &&
    isTeamConfiguration(value.teamA, 'teamA') &&
    isTeamConfiguration(value.teamB, 'teamB')
  )
}

/**
 * @param {unknown} value
 * @param {'teamA' | 'teamB'} expectedId
 * @returns {value is import('./match-state.js').TeamConfiguration}
 */
function isTeamConfiguration(value, expectedId) {
  return (
    isRecord(value) &&
    value.id === expectedId &&
    typeof value.label === 'string'
  )
}

/**
 * @param {unknown} value
 * @returns {value is import('./match-state.js').CurrentSetStatus}
 */
function isCurrentSetStatus(value) {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.number) &&
    isNonNegativeInteger(value.teamAGames) &&
    isNonNegativeInteger(value.teamBGames)
  )
}

/**
 * @param {unknown} value
 * @returns {value is import('./match-state.js').MatchStatus}
 */
function isMatchStatus(value) {
  return value === MATCH_STATUS.ACTIVE || value === MATCH_STATUS.FINISHED
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}
