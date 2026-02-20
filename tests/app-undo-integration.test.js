import assert from 'node:assert/strict'
import test from 'node:test'

import { createScoreViewModel } from '../page/score-view-model.js'
import { SCORE_POINTS } from '../utils/scoring-constants.js'

let appImportCounter = 0

async function loadAppDefinition() {
  const originalApp = globalThis.App
  let capturedDefinition = null

  globalThis.App = (definition) => {
    capturedDefinition = definition
  }

  const moduleUrl = new URL(
    `../app.js?integration=${Date.now()}-${appImportCounter}`,
    import.meta.url
  )
  appImportCounter += 1

  try {
    await import(moduleUrl.href)
  } finally {
    if (typeof originalApp === 'undefined') {
      delete globalThis.App
    } else {
      globalThis.App = originalApp
    }
  }

  if (!capturedDefinition) {
    throw new Error('App definition was not registered by app.js.')
  }

  return capturedDefinition
}

test('app exposes add/undo actions and keeps global match state in sync', async () => {
  const app = await loadAppDefinition()

  assert.equal(typeof app.addPointForTeam, 'function')
  assert.equal(typeof app.removePoint, 'function')

  const initialViewModel = createScoreViewModel(app.globalData.matchState)

  const stateAfterPoint = app.addPointForTeam('teamA')
  const viewModelAfterPoint = createScoreViewModel(app.globalData.matchState)

  assert.equal(stateAfterPoint.teamA.points, SCORE_POINTS.FIFTEEN)
  assert.equal(viewModelAfterPoint.teamA.points, SCORE_POINTS.FIFTEEN)
  assert.equal(app.globalData.matchHistory.size(), 1)

  const stateAfterUndo = app.removePoint()
  const viewModelAfterUndo = createScoreViewModel(app.globalData.matchState)

  assert.deepEqual(stateAfterUndo, app.globalData.matchState)
  assert.equal(viewModelAfterUndo.teamA.points, SCORE_POINTS.LOVE)
  assert.equal(viewModelAfterUndo.teamA.games, 0)
  assert.equal(viewModelAfterUndo.currentSetGames.teamA, 0)
  assert.deepEqual(viewModelAfterUndo, initialViewModel)
  assert.equal(app.globalData.matchHistory.size(), 0)
})
