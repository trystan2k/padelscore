import { migrateLegacySessions } from './utils/active-session-storage.js'
import { createHistoryStack } from './utils/history-stack.js'
import { createInitialMatchState } from './utils/match-state.js'
import {
  isMatchState as isPersistedMatchState,
  MATCH_STATUS as PERSISTED_MATCH_STATUS
} from './utils/match-state-schema.js'
import { saveMatchState } from './utils/match-storage.js'
import { addPoint, removePoint as undoPoint } from './utils/scoring-engine.js'
import { saveState } from './utils/storage.js'

/**
 * @param {Record<string, unknown>} appInstance
 * @param {import('./utils/match-state.js').MatchState} nextState
 * @returns {import('./utils/match-state.js').MatchState}
 */
function applyNextState(appInstance, nextState) {
  appInstance.globalData.matchState = nextState
  return nextState
}

function isRecord(value) {
  return typeof value === 'object' && value !== null
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

    // Persist the runtime state blob (fast, no schema conversion needed).
    saveState(runtimeState)

    // Also persist to the schema key if we have a valid persisted snapshot cached.
    // game.js keeps the last written schema snapshot in app.globalData._lastPersistedSchemaState
    // (set below in persistSchemaStateToGlobalData). This avoids needing to re-import
    // createPersistedMatchStateSnapshot here.
    const schemaSnapshot = globalData?._lastPersistedSchemaState

    if (
      isRecord(schemaSnapshot) &&
      isPersistedMatchState(schemaSnapshot) &&
      schemaSnapshot.status === PERSISTED_MATCH_STATUS.ACTIVE
    ) {
      saveMatchState(schemaSnapshot)
    }
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

    try {
      migrateLegacySessions({
        globalData: this.globalData
      })
    } catch {
      // Best-effort startup migration; never block app initialization.
    }
  },

  onDestroy(_options) {
    // Safety-net: persist current match state in case page.onDestroy was skipped
    // (e.g. OS hard-kill). If page.onDestroy already ran, this is a no-op because
    // the state on disk already matches globalData.
    emergencyPersistMatchState(this.globalData)
  }
})
