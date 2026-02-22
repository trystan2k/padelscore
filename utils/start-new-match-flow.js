import { clearMatchState } from './match-storage.js'
import { createHistoryStack } from './history-stack.js'
import { createInitialMatchState } from './match-state.js'
import { clearState } from './storage.js'

/**
 * Clears both schema and legacy persisted match session keys.
 * This operation is best-effort and idempotent.
 *
 * @returns {{ clearedSchema: boolean, clearedLegacy: boolean }}
 */
export function clearActiveMatchSession() {
  const result = {
    clearedSchema: false,
    clearedLegacy: false
  }

  try {
    clearMatchState()
    result.clearedSchema = true
  } catch {
    // Ignore schema-clear failures to keep reset flow resilient.
  }

  try {
    clearState()
    result.clearedLegacy = true
  } catch {
    // Ignore legacy-clear failures to keep reset flow resilient.
  }

  return result
}

/**
 * @returns {Record<string, unknown> | null}
 */
function resolveAppInstance() {
  if (typeof getApp !== 'function') {
    return null
  }

  try {
    const app = getApp()
    return app && typeof app === 'object' ? app : null
  } catch {
    return null
  }
}

/**
 * Resets runtime match manager data to initial defaults.
 *
 * @returns {{ didReset: boolean, resetMatchState: boolean, clearedMatchHistory: boolean, rehydratedMatchHistory: boolean }}
 */
export function resetMatchStateManager() {
  const result = {
    didReset: false,
    resetMatchState: false,
    clearedMatchHistory: false,
    rehydratedMatchHistory: false
  }

  const app = resolveAppInstance()

  if (!app || typeof app !== 'object') {
    return result
  }

  if (!app.globalData || typeof app.globalData !== 'object') {
    app.globalData = {}
  }

  app.globalData.matchState = createInitialMatchState()
  result.resetMatchState = true

  if (
    app.globalData.matchHistory &&
    typeof app.globalData.matchHistory.clear === 'function'
  ) {
    app.globalData.matchHistory.clear()
    result.clearedMatchHistory = true
    result.didReset = true
    return result
  }

  app.globalData.matchHistory = createHistoryStack()
  result.rehydratedMatchHistory = true
  result.didReset = true

  return result
}

/**
 * @returns {boolean}
 */
function navigateToMatchSetupPage() {
  if (typeof hmApp === 'undefined' || typeof hmApp.gotoPage !== 'function') {
    return false
  }

  try {
    hmApp.gotoPage({
      url: 'page/setup'
    })

    return true
  } catch {
    return false
  }
}

/**
 * Orchestrates clean reset + setup navigation for starting a new match.
 *
 * @returns {{
 *   clearSession: { clearedSchema: boolean, clearedLegacy: boolean },
 *   resetStateManager: { didReset: boolean, resetMatchState: boolean, clearedMatchHistory: boolean, rehydratedMatchHistory: boolean },
 *   navigatedToSetup: boolean,
 *   didEncounterError: boolean
 * }}
 */
export function startNewMatchFlow() {
  const result = {
    clearSession: { clearedSchema: false, clearedLegacy: false },
    resetStateManager: { didReset: false, resetMatchState: false, clearedMatchHistory: false, rehydratedMatchHistory: false },
    navigatedToSetup: false,
    didEncounterError: false
  }

  try {
    result.clearSession = clearActiveMatchSession()
  } catch {
    result.didEncounterError = true
  }

  try {
    result.resetStateManager = resetMatchStateManager()
  } catch {
    result.didEncounterError = true
  }

  try {
    result.navigatedToSetup = navigateToMatchSetupPage() === true
  } catch {
    result.didEncounterError = true
    result.navigatedToSetup = false
  }

  return result
}
