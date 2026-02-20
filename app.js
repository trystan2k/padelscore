import { createInitialMatchState } from './utils/match-state.js'
import { createHistoryStack } from './utils/history-stack.js'
import { addPoint, removePoint as undoPoint } from './utils/scoring-engine.js'

/**
 * @param {Record<string, unknown>} appInstance
 * @param {import('./utils/match-state.js').MatchState} nextState
 * @returns {import('./utils/match-state.js').MatchState}
 */
function applyNextState(appInstance, nextState) {
  appInstance.globalData.matchState = nextState
  return nextState
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

  onCreate(options) {
    console.log('app on create invoke')
  },

  onDestroy(options) {
    console.log('app on destroy invoke')
  }
})
