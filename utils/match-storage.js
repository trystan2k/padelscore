import {
  getActiveSession as readActiveSession,
  clearActiveSession as removeActiveSession,
  saveActiveSession as writeActiveSession
} from './active-session-storage.js'
import {
  deserializeMatchState,
  isMatchState,
  STORAGE_KEY as SCHEMA_STORAGE_KEY,
  serializeMatchState,
  toIsoTimestampSafe
} from './match-state-schema.js'

export const ACTIVE_MATCH_SESSION_STORAGE_KEY = SCHEMA_STORAGE_KEY

export class ZeppOsStorageAdapter {
  constructor() {
    /** @type {{ setItem?: (key: string, value: string) => void, getItem?: (key: string) => unknown, removeItem?: (key: string) => void } | null} */
    this.storage = null
  }

  /**
   * @param {string} key
   * @param {string} value
   */
  save(key, value) {
    if (!this.storage || typeof this.storage.setItem !== 'function') {
      return
    }

    try {
      this.storage.setItem(key, value)
    } catch {
      // Ignore persistence errors to keep app runtime stable.
    }
  }

  /**
   * @param {string} key
   * @returns {unknown}
   */
  load(key) {
    if (!this.storage || typeof this.storage.getItem !== 'function') {
      return null
    }

    try {
      const value = this.storage.getItem(key)
      return value ?? null
    } catch {
      return null
    }
  }

  /**
   * @param {string} key
   */
  clear(key) {
    if (!this.storage) {
      return
    }

    try {
      if (typeof this.storage.removeItem === 'function') {
        this.storage.removeItem(key)
      }
    } catch {
      // Ignore persistence errors to keep app runtime stable.
    }
  }
}

export class MatchStorage {
  /**
   * @param {{ save?: (key: string, value: string) => void, load?: (key: string) => unknown, clear?: (key: string) => void } | null} [adapter]
   */
  constructor(adapter = null) {
    this.adapter = adapter
  }

  /**
   * @param {import('./match-state-schema.js').MatchState} state
   */
  saveMatchState(state) {
    if (!isMatchState(state)) {
      return
    }

    const updatedAt = Date.now()
    const updatedAtIso = toIsoTimestampSafe(updatedAt)

    state.updatedAt = updatedAt

    if (!state.timing || typeof state.timing !== 'object') {
      state.timing = {
        createdAt: updatedAtIso,
        updatedAt: updatedAtIso,
        startedAt: updatedAtIso,
        finishedAt: state.status === 'finished' ? updatedAtIso : null
      }
    } else {
      state.timing.updatedAt = updatedAtIso

      if (typeof state.timing.startedAt !== 'string') {
        state.timing.startedAt =
          typeof state.timing.createdAt === 'string'
            ? state.timing.createdAt
            : updatedAtIso
      }

      if (typeof state.timing.createdAt !== 'string') {
        state.timing.createdAt = state.timing.startedAt
      }

      if (state.status !== 'finished') {
        state.timing.finishedAt = null
      } else if (typeof state.timing.finishedAt !== 'string') {
        state.timing.finishedAt = updatedAtIso
      }
    }

    const serialized = serializeMatchState(state)
    syncStateWithSerializedSnapshot(state, serialized)

    if (this.adapter && typeof this.adapter.save === 'function') {
      try {
        this.adapter.save(ACTIVE_MATCH_SESSION_STORAGE_KEY, serialized)
      } catch {
        // Ignore persistence errors to keep app runtime stable.
      }
      return
    }

    writeActiveSession(state, { preserveUpdatedAt: true })
  }

  /**
   * @returns {import('./match-state-schema.js').MatchState | null}
   */
  loadMatchState() {
    if (this.adapter && typeof this.adapter.load === 'function') {
      try {
        const serializedState = this.adapter.load(
          ACTIVE_MATCH_SESSION_STORAGE_KEY
        )

        if (
          typeof serializedState !== 'string' ||
          serializedState.length === 0
        ) {
          return null
        }

        const loadedState = deserializeMatchState(serializedState)

        return isMatchState(loadedState) ? loadedState : null
      } catch {
        return null
      }
    }

    const activeSession = readActiveSession()
    return isMatchState(activeSession) ? activeSession : null
  }

  clearMatchState() {
    if (this.adapter && typeof this.adapter.clear === 'function') {
      try {
        this.adapter.clear(ACTIVE_MATCH_SESSION_STORAGE_KEY)
      } catch {
        // Ignore persistence errors to keep app runtime stable.
      }
    }

    // Always clear canonical/legacy filesystem artifacts as a safety-net.
    removeActiveSession()
  }
}

export const matchStorage = new MatchStorage()

/**
 * Compatibility helper for app/page flows using the unified session API.
 * Routes through MatchStorage so tests can continue to override the adapter.
 *
 * @returns {import('./match-state-schema.js').MatchState | null}
 */
export function getActiveSession() {
  return matchStorage.loadMatchState()
}

/**
 * @param {import('./match-state-schema.js').MatchState} state
 */
export function saveActiveSession(state) {
  matchStorage.saveMatchState(state)
}

export function clearActiveSession() {
  matchStorage.clearMatchState()
}

/**
 * @param {import('./match-state-schema.js').MatchState} state
 */
export function saveMatchState(state) {
  saveActiveSession(state)
}

/**
 * @returns {import('./match-state-schema.js').MatchState | null}
 */
export function loadMatchState() {
  return matchStorage.loadMatchState()
}

export function clearMatchState() {
  clearActiveSession()
}

/**
 * @param {import('./match-state-schema.js').MatchState} state
 * @param {string} serialized
 */
function syncStateWithSerializedSnapshot(state, serialized) {
  const normalizedState = deserializeMatchState(serialized)

  if (!normalizedState) {
    return
  }

  Object.assign(state, normalizedState)
}
