import {
  getActiveSession,
  saveActiveSession,
  updateActiveSession
} from './utils/active-session-storage.js'
import { createHistoryStack } from './utils/history-stack.js'
import { createInitialMatchState } from './utils/match-state.js'
import {
  isMatchState as isPersistedMatchState,
  MATCH_STATUS as PERSISTED_MATCH_STATUS
} from './utils/match-state-schema.js'
import { ensureStorageSchema } from './utils/persistence.js'
import { addPoint, removePoint as undoPoint } from './utils/scoring-engine.js'
import { isRecord, toNonNegativeInteger } from './utils/validation.js'

function applyNextState(appInstance, nextState) {
  appInstance.globalData.matchState = nextState
  return nextState
}

function emergencyPersistMatchState(globalData) {
  try {
    const runtimeState = globalData?.matchState

    if (!isRecord(runtimeState) || runtimeState.status !== 'active') {
      return
    }

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
    // Never let app.onDestroy throw.
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
    try {
      ensureStorageSchema()
    } catch {
      // Best-effort schema bootstrap; never block app initialization.
    }
  },

  onDestroy(_options) {
    emergencyPersistMatchState(this.globalData)
  }
})
