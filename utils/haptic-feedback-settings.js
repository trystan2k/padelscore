import {
  keyToFilename,
  loadFromFile,
  saveToFile
} from './match-history-storage.js'

export const HAPTIC_FEEDBACK_STORAGE_KEY = 'padel-buddy.haptic-feedback-enabled'

const HAPTIC_FEEDBACK_DEFAULT_ENABLED = true
const HAPTIC_FEEDBACK_ENABLED_VALUE = 'true'
const HAPTIC_FEEDBACK_DISABLED_VALUE = 'false'

const fallbackStorage = createInMemoryStorageAdapter()

function createInMemoryStorageAdapter() {
  const map = new Map()

  return {
    setItem(key, value) {
      map.set(key, String(value))
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    removeItem(key) {
      map.delete(key)
    }
  }
}

function resolveSettingsStorage() {
  if (
    typeof settingsStorage !== 'undefined' &&
    settingsStorage &&
    typeof settingsStorage.getItem === 'function' &&
    typeof settingsStorage.setItem === 'function'
  ) {
    return settingsStorage
  }

  return null
}

function isHmFsStorageAvailable() {
  return (
    typeof hmFS !== 'undefined' &&
    typeof hmFS.open === 'function' &&
    typeof hmFS.close === 'function' &&
    typeof hmFS.read === 'function' &&
    typeof hmFS.write === 'function' &&
    typeof hmFS.stat === 'function' &&
    typeof hmFS.remove === 'function'
  )
}

function createHmFsStorageAdapter() {
  return {
    setItem(key, value) {
      const filename = keyToFilename(key)
      saveToFile(filename, String(value))
    },

    getItem(key) {
      const filename = keyToFilename(key)
      return loadFromFile(filename)
    },

    removeItem(key) {
      try {
        hmFS.remove(keyToFilename(key))
      } catch {
        // Ignore delete errors.
      }
    }
  }
}

function getRuntimeStorage() {
  if (isHmFsStorageAvailable()) {
    return createHmFsStorageAdapter()
  }

  const runtimeSettingsStorage = resolveSettingsStorage()

  if (runtimeSettingsStorage) {
    return runtimeSettingsStorage
  }

  return fallbackStorage
}

function parseHapticFeedbackEnabled(value) {
  if (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === HAPTIC_FEEDBACK_ENABLED_VALUE
  ) {
    return true
  }

  if (
    value === false ||
    value === 0 ||
    value === '0' ||
    value === HAPTIC_FEEDBACK_DISABLED_VALUE
  ) {
    return false
  }

  return HAPTIC_FEEDBACK_DEFAULT_ENABLED
}

export function loadHapticFeedbackEnabled() {
  try {
    const storedValue = getRuntimeStorage().getItem(HAPTIC_FEEDBACK_STORAGE_KEY)
    return parseHapticFeedbackEnabled(storedValue)
  } catch {
    return HAPTIC_FEEDBACK_DEFAULT_ENABLED
  }
}

export function saveHapticFeedbackEnabled(enabled) {
  const normalizedEnabled = enabled === true

  try {
    getRuntimeStorage().setItem(
      HAPTIC_FEEDBACK_STORAGE_KEY,
      normalizedEnabled
        ? HAPTIC_FEEDBACK_ENABLED_VALUE
        : HAPTIC_FEEDBACK_DISABLED_VALUE
    )
  } catch {
    // Ignore persistence errors.
  }

  return normalizedEnabled
}

export function clearHapticFeedbackEnabled() {
  try {
    getRuntimeStorage().removeItem(HAPTIC_FEEDBACK_STORAGE_KEY)
  } catch {
    // Ignore delete errors.
  }
}
