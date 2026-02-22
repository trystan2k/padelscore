import {
  STORAGE_KEY as SCHEMA_STORAGE_KEY,
  deserializeMatchState,
  isMatchState,
  serializeMatchState
} from './match-state-schema.js'

export const ACTIVE_MATCH_SESSION_STORAGE_KEY = SCHEMA_STORAGE_KEY

/**
 * Returns a storage adapter backed by hmFS.SysProSetChars / SysProGetChars,
 * which is the correct key-value string storage API for Zepp OS 1.0 device apps.
 * Falls back to null if hmFS is unavailable (e.g. in tests or app-side context).
 *
 * @returns {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null), removeItem: (key: string) => void } | null}
 */
function resolveRuntimeStorage() {
  if (
    typeof hmFS !== 'undefined' &&
    typeof hmFS.SysProSetChars === 'function' &&
    typeof hmFS.SysProGetChars === 'function'
  ) {
    return {
      setItem(key, value) {
        try {
          hmFS.SysProSetChars(key, value)
        } catch {
          // Ignore write errors to keep app runtime stable.
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
          // Ignore delete errors to keep app runtime stable.
        }
      }
    }
  }

  return null
}

export class ZeppOsStorageAdapter {
  constructor() {
    /** @type {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null), removeItem: (key: string) => void } | null} */
    this.storage = resolveRuntimeStorage()
  }

  /**
   * @param {string} key
   * @param {string} value
   */
  save(key, value) {
    const storage = this.storage || resolveRuntimeStorage()

    if (!storage) {
      return
    }

    if (!this.storage) {
      this.storage = storage
    }

    try {
      storage.setItem(key, value)
    } catch {
      // Ignore persistence errors to keep app runtime stable.
    }
  }

  /**
   * @param {string} key
   * @returns {string | null}
   */
  load(key) {
    const storage = this.storage || resolveRuntimeStorage()

    if (!storage) {
      return null
    }

    if (!this.storage) {
      this.storage = storage
    }

    try {
      return storage.getItem(key)
    } catch {
      return null
    }
  }

  /**
   * @param {string} key
   */
  clear(key) {
    const storage = this.storage || resolveRuntimeStorage()

    if (!storage) {
      return
    }

    if (!this.storage) {
      this.storage = storage
    }

    try {
      storage.removeItem(key)
    } catch {
      // Ignore persistence errors to keep app runtime stable.
    }
  }
}

export class MatchStorage {
  /**
   * @param {ZeppOsStorageAdapter} [adapter]
   */
  constructor(adapter = new ZeppOsStorageAdapter()) {
    this.adapter = adapter
  }

  /**
   * @param {import('./match-state-schema.js').MatchState} state
   */
  saveMatchState(state) {
    if (!isMatchState(state)) {
      return
    }

    state.updatedAt = Date.now()

    try {
      this.adapter.save(
        ACTIVE_MATCH_SESSION_STORAGE_KEY,
        serializeMatchState(state)
      )
    } catch {
      // Ignore persistence errors to keep app runtime stable.
    }
  }

  /**
   * @returns {import('./match-state-schema.js').MatchState | null}
   */
  loadMatchState() {
    try {
      const serializedState = this.adapter.load(ACTIVE_MATCH_SESSION_STORAGE_KEY)

      if (typeof serializedState !== 'string' || serializedState.length === 0) {
        return null
      }

      const loadedState = deserializeMatchState(serializedState)

      return isMatchState(loadedState) ? loadedState : null
    } catch {
      return null
    }
  }

  clearMatchState() {
    try {
      this.adapter.clear(ACTIVE_MATCH_SESSION_STORAGE_KEY)
    } catch {
      // Ignore persistence errors to keep app runtime stable.
    }
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
