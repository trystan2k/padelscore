import {
  clearActiveSession,
  getActiveSession,
  saveActiveSession
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
    state.updatedAt = updatedAt
    if (state.timing && typeof state.timing === 'object') {
      state.timing.updatedAt = toIsoTimestampSafe(updatedAt)
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

    saveActiveSession(state, { preserveUpdatedAt: true })
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

    const activeSession = getActiveSession()
    return isMatchState(activeSession) ? activeSession : null
  }

  clearMatchState() {
    if (this.adapter && typeof this.adapter.clear === 'function') {
      try {
        this.adapter.clear(ACTIVE_MATCH_SESSION_STORAGE_KEY)
      } catch {
        // Ignore persistence errors to keep app runtime stable.
      }
      return
    }

    clearActiveSession()
  }
}

export const matchStorage = new MatchStorage()

/**
 * @param {import('./match-state-schema.js').MatchState} state
 */
export function saveMatchState(state) {
  matchStorage.saveMatchState(state)
}

/**
 * @returns {import('./match-state-schema.js').MatchState | null}
 */
export function loadMatchState() {
  return matchStorage.loadMatchState()
}

export function clearMatchState() {
  matchStorage.clearMatchState()
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
