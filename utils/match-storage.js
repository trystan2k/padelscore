import {
  STORAGE_KEY as SCHEMA_STORAGE_KEY,
  deserializeMatchState,
  isMatchState,
  serializeMatchState
} from './match-state-schema.js'

export const ACTIVE_MATCH_SESSION_STORAGE_KEY = SCHEMA_STORAGE_KEY

/**
 * @typedef StorageAdapter
 * @property {(key: string, value: string) => Promise<void>} save
 * @property {(key: string) => Promise<string | null>} load
 * @property {(key: string) => Promise<void>} clear
 */

/**
 * @typedef ZeppSettingsStorage
 * @property {(key: string, value: string) => void} [setItem]
 * @property {(key: string) => (string | null | undefined)} [getItem]
 * @property {(key: string) => void} [removeItem]
 */

/**
 * @returns {ZeppSettingsStorage | null}
 */
function resolveRuntimeStorage() {
  if (typeof settingsStorage !== 'undefined' && settingsStorage) {
    return settingsStorage
  }

  if (typeof globalThis !== 'undefined' && globalThis.settingsStorage) {
    return globalThis.settingsStorage
  }

  return null
}

export class ZeppOsStorageAdapter {
  /**
   * @param {ZeppSettingsStorage | null} [storage]
   */
  constructor(storage = resolveRuntimeStorage()) {
    /** @type {ZeppSettingsStorage | null} */
    this.storage = storage
  }

  /**
   * @returns {ZeppSettingsStorage | null}
   */
  resolveStorage() {
    if (this.storage) {
      return this.storage
    }

    const runtimeStorage = resolveRuntimeStorage()

    if (runtimeStorage) {
      this.storage = runtimeStorage
    }

    return this.storage
  }

  /**
   * @param {string} key
   * @param {string} value
   * @returns {Promise<void>}
   */
  async save(key, value) {
    const storage = this.resolveStorage()

    if (!storage || typeof storage.setItem !== 'function') {
      return
    }

    try {
      storage.setItem(key, value)
    } catch {
      // Ignore persistence errors to keep app runtime stable.
    }
  }

  /**
   * @param {string} key
   * @returns {Promise<string | null>}
   */
  async load(key) {
    const storage = this.resolveStorage()

    if (!storage || typeof storage.getItem !== 'function') {
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
  }

  /**
   * @param {string} key
   * @returns {Promise<void>}
   */
  async clear(key) {
    const storage = this.resolveStorage()

    if (!storage) {
      return
    }

    if (typeof storage.removeItem === 'function') {
      try {
        storage.removeItem(key)
      } catch {
        // Ignore persistence errors to keep app runtime stable.
      }

      return
    }

    if (typeof storage.setItem === 'function') {
      try {
        storage.setItem(key, '')
      } catch {
        // Ignore persistence errors to keep app runtime stable.
      }
    }
  }
}

export class MatchStorage {
  /**
   * @param {StorageAdapter} [adapter]
   */
  constructor(adapter = new ZeppOsStorageAdapter()) {
    /** @type {StorageAdapter} */
    this.adapter = adapter
  }

  /**
   * @param {import('./match-state-schema.js').MatchState} state
   * @returns {Promise<void>}
   */
  async saveMatchState(state) {
    if (!isMatchState(state)) {
      return
    }

    state.updatedAt = Date.now()

    await this.adapter.save(
      ACTIVE_MATCH_SESSION_STORAGE_KEY,
      serializeMatchState(state)
    )
  }

  /**
   * @returns {Promise<import('./match-state-schema.js').MatchState | null>}
   */
  async loadMatchState() {
    try {
      const serializedState = await this.adapter.load(
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      )

      if (typeof serializedState !== 'string' || serializedState.length === 0) {
        return null
      }

      const loadedState = deserializeMatchState(serializedState)

      return isMatchState(loadedState) ? loadedState : null
    } catch {
      return null
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async clearMatchState() {
    try {
      await this.adapter.clear(ACTIVE_MATCH_SESSION_STORAGE_KEY)
    } catch {
      // Ignore persistence errors to keep app runtime stable.
    }
  }
}

export const matchStorage = new MatchStorage()

/**
 * @param {import('./match-state-schema.js').MatchState} state
 * @returns {Promise<void>}
 */
export async function saveMatchState(state) {
  await matchStorage.saveMatchState(state)
}

/**
 * @returns {Promise<import('./match-state-schema.js').MatchState | null>}
 */
export async function loadMatchState() {
  return matchStorage.loadMatchState()
}

/**
 * @returns {Promise<void>}
 */
export async function clearMatchState() {
  await matchStorage.clearMatchState()
}
