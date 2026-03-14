import { clearHapticFeedbackEnabled } from './haptic-feedback-settings.js'
import { clearMatchHistory } from './match-history-storage.js'
import { clearMatchState } from './match-storage.js'
import { clearAllState } from './persistence.js'

export function clearAllAppData() {
  let success = true

  try {
    if (clearMatchState() !== true) {
      success = false
    }
  } catch {
    success = false
  }

  try {
    if (clearMatchHistory() !== true) {
      success = false
    }
  } catch {
    success = false
  }

  try {
    if (clearHapticFeedbackEnabled() !== true) {
      success = false
    }
  } catch {
    success = false
  }

  try {
    if (clearAllState() !== true) {
      success = false
    }
  } catch {
    success = false
  }

  try {
    if (typeof getApp === 'function') {
      const app = getApp()

      if (app?.globalData) {
        app.globalData.matchState = null
        app.globalData.matchHistory = null
        app.globalData._lastPersistedSchemaState = null
      }
    }
  } catch {
    // Ignore in-memory cleanup errors.
  }

  return success
}
