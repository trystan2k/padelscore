import {
  getActiveSession,
  migrateLegacySessions,
  saveActiveSession,
  updateActiveSession
} from './utils/active-session-storage.js'
import { createHistoryStack } from './utils/history-stack.js'
import { createInitialMatchState } from './utils/match-state.js'
import {
  isMatchState as isPersistedMatchState,
  MATCH_STATUS as PERSISTED_MATCH_STATUS
} from './utils/match-state-schema.js'
import { addPoint, removePoint as undoPoint } from './utils/scoring-engine.js'
import { isRecord, toNonNegativeInteger } from './utils/validation.js'

/**
 * @param {Record<string, unknown>} appInstance
 * @param {import('./utils/match-state.js').MatchState} nextState
 * @returns {import('./utils/match-state.js').MatchState}
 */
function applyNextState(appInstance, nextState) {
  appInstance.globalData.matchState = nextState
  return nextState
}

const STARTUP_MIGRATION_FLAG_KEY = '_didRunLegacySessionMigration'

/**
 * @param {Record<string, unknown>} appInstance
 */
function runStartupSessionMigration(appInstance) {
  if (!isRecord(appInstance)) {
    return
  }

  if (!isRecord(appInstance.globalData)) {
    appInstance.globalData = {}
  }

  if (appInstance.globalData[STARTUP_MIGRATION_FLAG_KEY] === true) {
    return
  }

  try {
    migrateLegacySessions()
  } catch {
    // Best-effort startup migration; never block app initialization.
  } finally {
    appInstance.globalData[STARTUP_MIGRATION_FLAG_KEY] = true
  }
}

/**
 * Persist the current runtime match state directly from globalData.
 * Called as a last-resort safety net from app.onDestroy when the page
 * onDestroy may not have had a chance to flush (e.g. hard OS kill scenario).
 *
 * @param {Record<string, unknown>} globalData
 */
function emergencyPersistMatchState(globalData) {
  try {
    const runtimeState = globalData?.matchState

    if (!isRecord(runtimeState) || runtimeState.status !== 'active') {
      return
    }

    // Prefer the latest validated persisted snapshot cached by game.js.
    // Fallback to the runtime state shape as a best-effort write attempt.
    const schemaSnapshot = globalData?._lastPersistedSchemaState
    const stateToPersist =
      isRecord(schemaSnapshot) &&
      isPersistedMatchState(schemaSnapshot) &&
      schemaSnapshot.status === PERSISTED_MATCH_STATUS.ACTIVE
        ? schemaSnapshot
        : runtimeState

    if (
      !isRecord(stateToPersist) ||
      !isPersistedMatchState(stateToPersist) ||
      stateToPersist.status !== PERSISTED_MATCH_STATUS.ACTIVE
    ) {
      return
    }

    const didUpdateInPlace =
      updateActiveSession(
        (currentSession) => {
          if (
            isRecord(currentSession) &&
            isPersistedMatchState(currentSession) &&
            toNonNegativeInteger(currentSession.updatedAt, 0) >
              toNonNegativeInteger(stateToPersist.updatedAt, 0)
          ) {
            return currentSession
          }

          return stateToPersist
        },
        { preserveUpdatedAt: true }
      ) !== null

    if (didUpdateInPlace) {
      return
    }

    const existingSession = getActiveSession()

    if (
      isRecord(existingSession) &&
      isPersistedMatchState(existingSession) &&
      toNonNegativeInteger(existingSession.updatedAt, 0) >
        toNonNegativeInteger(stateToPersist.updatedAt, 0)
    ) {
      return
    }

    saveActiveSession(stateToPersist, { preserveUpdatedAt: true })
  } catch {
    // Never let app.onDestroy throw — it would prevent proper app teardown.
  }
}

App({
  globalData: {
    matchState: createInitialMatchState(),
    matchHistory: createHistoryStack()
  },
  addPointForTeam(team) {
    const nextState = addPoint(
      this.globalData.matchState,
      team,
      this.globalData.matchHistory
    )

    return applyNextState(this, nextState)
  },

  removePoint() {
    const restoredState = undoPoint(
      this.globalData.matchState,
      this.globalData.matchHistory
    )

    return applyNextState(this, restoredState)
  },

  onCreate(_options) {
    // Ensure that if the screen turns off while the app is active,
    // the watch re-launches this app instead of returning to the watchface.
    if (
      typeof hmApp !== 'undefined' &&
      typeof hmApp.setScreenKeep === 'function'
    ) {
      hmApp.setScreenKeep(true)
    }

    runStartupSessionMigration(this)
  },

  onDestroy(_options) {
    // Safety-net: persist current match state in case page.onDestroy was skipped
    // (e.g. OS hard-kill). If page.onDestroy already ran, this is a no-op because
    // the state on disk already matches globalData.
    emergencyPersistMatchState(this.globalData)
  }
})
