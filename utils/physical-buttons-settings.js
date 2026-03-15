import { deleteState, loadState, saveState } from './persistence.js'

export const PHYSICAL_BUTTONS_STORAGE_KEY =
  'padel-buddy.physical-buttons-enabled'

const PHYSICAL_BUTTONS_DEFAULT_ENABLED = false

function parsePhysicalButtonsEnabled(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return true
  }

  if (value === false || value === 0 || value === '0' || value === 'false') {
    return false
  }

  return PHYSICAL_BUTTONS_DEFAULT_ENABLED
}

export function loadPhysicalButtonsEnabled() {
  try {
    const storedValue = loadState(PHYSICAL_BUTTONS_STORAGE_KEY)
    return parsePhysicalButtonsEnabled(storedValue)
  } catch {
    return PHYSICAL_BUTTONS_DEFAULT_ENABLED
  }
}

export function savePhysicalButtonsEnabled(enabled) {
  const normalizedEnabled = enabled === true

  try {
    saveState(PHYSICAL_BUTTONS_STORAGE_KEY, normalizedEnabled)
  } catch {
    // Ignore persistence errors.
  }

  return normalizedEnabled
}

export function clearPhysicalButtonsEnabled() {
  try {
    return deleteState(PHYSICAL_BUTTONS_STORAGE_KEY)
  } catch {
    return false
  }
}
