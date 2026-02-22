import { clearMatchState } from './match-storage.js'
import { createHistoryStack } from './history-stack.js'
import { createInitialMatchState } from './match-state.js'
import { clearState } from './storage.js'

/**
 * @typedef ClearActiveMatchSessionDependencies
 * @property {(() => Promise<void>) | (() => void)} [clearSchemaSession]
 * @property {(() => Promise<void>) | (() => void)} [clearLegacySession]
 */

/**
 * Clears both schema and legacy persisted match session keys.
 * This operation is best-effort and idempotent.
 *
 * @param {ClearActiveMatchSessionDependencies} [dependencies]
 * @returns {Promise<{ clearedSchema: boolean, clearedLegacy: boolean }>}
 */
export async function clearActiveMatchSession(dependencies = {}) {
  const {
    clearSchemaSession = clearMatchState,
    clearLegacySession = clearState
  } = dependencies

  const result = {
    clearedSchema: false,
    clearedLegacy: false
  }

  try {
    await clearSchemaSession()
    result.clearedSchema = true
  } catch {
    // Ignore schema-clear failures to keep reset flow resilient.
  }

  try {
    await clearLegacySession()
    result.clearedLegacy = true
  } catch {
    // Ignore legacy-clear failures to keep reset flow resilient.
  }

  return result
}

/**
 * @typedef ResetMatchStateManagerDependencies
 * @property {(() => unknown)} [getAppInstance]
 * @property {(() => import('./match-state.js').MatchState)} [createInitialState]
 * @property {(() => import('./history-stack.js').HistoryStack<import('./match-state.js').MatchState>)} [createHistory]
 */

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
 * @param {ResetMatchStateManagerDependencies} [dependencies]
 * @returns {{ didReset: boolean, resetMatchState: boolean, clearedMatchHistory: boolean, rehydratedMatchHistory: boolean }}
 */
export function resetMatchStateManager(dependencies = {}) {
  const {
    getAppInstance = resolveAppInstance,
    createInitialState = createInitialMatchState,
    createHistory = createHistoryStack
  } = dependencies

  const result = {
    didReset: false,
    resetMatchState: false,
    clearedMatchHistory: false,
    rehydratedMatchHistory: false
  }

  const app = getAppInstance()

  if (!app || typeof app !== 'object') {
    return result
  }

  if (!app.globalData || typeof app.globalData !== 'object') {
    app.globalData = {}
  }

  app.globalData.matchState = createInitialState()
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

  app.globalData.matchHistory = createHistory()
  result.rehydratedMatchHistory = true
  result.didReset = true

  return result
}

function createDefaultClearSessionResult() {
  return {
    clearedSchema: false,
    clearedLegacy: false
  }
}

function createDefaultResetManagerResult() {
  return {
    didReset: false,
    resetMatchState: false,
    clearedMatchHistory: false,
    rehydratedMatchHistory: false
  }
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
 * @param {unknown} value
 * @returns {{ clearedSchema: boolean, clearedLegacy: boolean }}
 */
function normalizeClearSessionResult(value) {
  const fallback = createDefaultClearSessionResult()

  if (!value || typeof value !== 'object') {
    return fallback
  }

  return {
    clearedSchema: value.clearedSchema === true,
    clearedLegacy: value.clearedLegacy === true
  }
}

/**
 * @param {unknown} value
 * @returns {{ didReset: boolean, resetMatchState: boolean, clearedMatchHistory: boolean, rehydratedMatchHistory: boolean }}
 */
function normalizeResetManagerResult(value) {
  const fallback = createDefaultResetManagerResult()

  if (!value || typeof value !== 'object') {
    if (typeof value === 'boolean') {
      fallback.didReset = value
    }

    return fallback
  }

  return {
    didReset: value.didReset === true,
    resetMatchState: value.resetMatchState === true,
    clearedMatchHistory: value.clearedMatchHistory === true,
    rehydratedMatchHistory: value.rehydratedMatchHistory === true
  }
}

/**
 * @typedef StartNewMatchFlowDependencies
 * @property {(() => Promise<{ clearedSchema: boolean, clearedLegacy: boolean }>) | (() => { clearedSchema: boolean, clearedLegacy: boolean })} [clearSession]
 * @property {(() => Promise<{ didReset: boolean, resetMatchState: boolean, clearedMatchHistory: boolean, rehydratedMatchHistory: boolean }>) | (() => { didReset: boolean, resetMatchState: boolean, clearedMatchHistory: boolean, rehydratedMatchHistory: boolean })} [resetStateManager]
 * @property {(() => Promise<boolean>) | (() => boolean)} [navigateToSetup]
 */

/**
 * Orchestrates clean reset + setup navigation for starting a new match.
 *
 * @param {StartNewMatchFlowDependencies} [dependencies]
 * @returns {Promise<{
 *   clearSession: { clearedSchema: boolean, clearedLegacy: boolean },
 *   resetStateManager: { didReset: boolean, resetMatchState: boolean, clearedMatchHistory: boolean, rehydratedMatchHistory: boolean },
 *   navigatedToSetup: boolean,
 *   didEncounterError: boolean
 * }>}
 */
export async function startNewMatchFlow(dependencies = {}) {
  const {
    clearSession = clearActiveMatchSession,
    resetStateManager = resetMatchStateManager,
    navigateToSetup = navigateToMatchSetupPage
  } = dependencies

  const result = {
    clearSession: createDefaultClearSessionResult(),
    resetStateManager: createDefaultResetManagerResult(),
    navigatedToSetup: false,
    didEncounterError: false
  }

  try {
    result.clearSession = normalizeClearSessionResult(await clearSession())
  } catch {
    result.didEncounterError = true
  }

  try {
    result.resetStateManager = normalizeResetManagerResult(await resetStateManager())
  } catch {
    result.didEncounterError = true
  }

  try {
    result.navigatedToSetup = (await navigateToSetup()) === true
  } catch {
    result.didEncounterError = true
    result.navigatedToSetup = false
  }

  return result
}
