import { storage } from './platform-adapters.js'

export const CURRENT_STORAGE_SCHEMA_VERSION = 1
export const STORAGE_SCHEMA_VERSION_KEY = 'padel-buddy.storage-schema-version'
export const STORAGE_SCHEMA_META_KEY = 'padel-buddy.storage-schema-meta'

/** @type {Map<number, () => void>} */
const storageSchemaMigrations = new Map([[0, bootstrapStorageSchema]])

let cachedSchemaVersion = null

function bootstrapStorageSchema() {
  // Fresh installs and current LocalStorage data need no transformation.
}

function normalizeSchemaVersion(value) {
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    Math.floor(value) === value
  ) {
    return value
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number.parseInt(value, 10)

    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return 0
}

function saveStorageSchemaMetadata(previousVersion, currentVersion) {
  try {
    storage.setItem(STORAGE_SCHEMA_VERSION_KEY, currentVersion)
    storage.setItem(STORAGE_SCHEMA_META_KEY, {
      previousVersion,
      currentVersion,
      ensuredAt: Date.now()
    })
  } catch {
    // Ignore storage metadata failures.
  }
}

export function ensureStorageSchema() {
  const previousVersion = normalizeSchemaVersion(
    storage.getItem(STORAGE_SCHEMA_VERSION_KEY)
  )

  if (
    cachedSchemaVersion === CURRENT_STORAGE_SCHEMA_VERSION &&
    previousVersion === CURRENT_STORAGE_SCHEMA_VERSION
  ) {
    return cachedSchemaVersion
  }

  if (previousVersion >= CURRENT_STORAGE_SCHEMA_VERSION) {
    cachedSchemaVersion = previousVersion
    return cachedSchemaVersion
  }

  let nextVersion = previousVersion

  while (nextVersion < CURRENT_STORAGE_SCHEMA_VERSION) {
    const migrateStep = storageSchemaMigrations.get(nextVersion)

    if (typeof migrateStep !== 'function') {
      throw new Error(
        `Missing storage schema migration for version ${nextVersion}`
      )
    }

    migrateStep()
    nextVersion += 1
  }

  saveStorageSchemaMetadata(previousVersion, nextVersion)
  cachedSchemaVersion = nextVersion

  return cachedSchemaVersion
}

/**
 * @template T
 * @param {string} key
 * @param {T} value
 * @param {{ validate?: (value: unknown) => boolean }} [options]
 * @returns {boolean}
 */
export function saveState(key, value, options = {}) {
  ensureStorageSchema()

  if (typeof options.validate === 'function' && !options.validate(value)) {
    return false
  }

  try {
    return storage.setItem(key, value) !== null
  } catch {
    return false
  }
}

/**
 * @template T
 * @param {string} key
 * @param {{ fallback?: T | null, revive?: (value: unknown) => T | null, validate?: (value: unknown) => boolean }} [options]
 * @returns {T | null}
 */
export function loadState(key, options = {}) {
  ensureStorageSchema()

  const fallback = options.fallback ?? null

  let storedValue

  try {
    storedValue = storage.getItem(key)
  } catch {
    return fallback
  }

  if (storedValue === null || typeof storedValue === 'undefined') {
    return fallback
  }

  const revivedValue =
    typeof options.revive === 'function'
      ? options.revive(storedValue)
      : /** @type {T} */ (storedValue)

  if (revivedValue === null) {
    return fallback
  }

  if (
    typeof options.validate === 'function' &&
    !options.validate(revivedValue)
  ) {
    return fallback
  }

  return revivedValue
}

export function deleteState(key) {
  ensureStorageSchema()

  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function clearStateKeys(keys) {
  let didClearAllKeys = true

  for (const key of keys) {
    if (deleteState(key) !== true) {
      didClearAllKeys = false
    }
  }

  return didClearAllKeys
}

export function clearAllState() {
  cachedSchemaVersion = null

  try {
    storage.clear()
    return true
  } catch {
    return false
  }
}
