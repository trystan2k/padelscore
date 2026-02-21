import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createScoreViewModel } from '../page/score-view-model.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { createHistoryStack } from '../utils/history-stack.js'
import { SCORE_POINTS } from '../utils/scoring-constants.js'

let gamePageImportCounter = 0

function createHmUiRecorder() {
  const createdWidgets = []

  return {
    createdWidgets,
    hmUI: {
      widget: {
        FILL_RECT: 'FILL_RECT',
        TEXT: 'TEXT',
        BUTTON: 'BUTTON'
      },
      align: {
        CENTER_H: 'CENTER_H',
        CENTER_V: 'CENTER_V'
      },
      createWidget(type, properties) {
        const widget = {
          type,
          properties,
          deleted: false
        }

        createdWidgets.push(widget)
        return widget
      },
      deleteWidget(widget) {
        if (widget && typeof widget === 'object') {
          widget.deleted = true
        }
      }
    }
  }
}

function createPageInstance(definition) {
  return {
    ...definition
  }
}

async function loadGamePageDefinition() {
  const sourceUrl = new URL('../page/game.js', import.meta.url)
  const scoreViewModelUrl = new URL('../page/score-view-model.js', import.meta.url)
  const historyStackUrl = new URL('../utils/history-stack.js', import.meta.url)
  const matchStateUrl = new URL('../utils/match-state.js', import.meta.url)
  const scoringEngineUrl = new URL('../utils/scoring-engine.js', import.meta.url)
  const storageUrl = new URL('../utils/storage.js', import.meta.url)

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace("import { gettext } from 'i18n'\n", 'const gettext = (key) => key\n')
    .replace("from './score-view-model.js'", `from '${scoreViewModelUrl.href}'`)
    .replace("from '../utils/history-stack.js'", `from '${historyStackUrl.href}'`)
    .replace("from '../utils/match-state.js'", `from '${matchStateUrl.href}'`)
    .replace("from '../utils/scoring-engine.js'", `from '${scoringEngineUrl.href}'`)
    .replace("from '../utils/storage.js'", `from '${storageUrl.href}'`)

  const moduleUrl =
    'data:text/javascript;charset=utf-8,' +
    encodeURIComponent(source) +
    `#game-screen-layout-${Date.now()}-${gamePageImportCounter}`

  gamePageImportCounter += 1

  const originalPage = globalThis.Page
  let capturedDefinition = null

  globalThis.Page = (definition) => {
    capturedDefinition = definition
  }

  try {
    await import(moduleUrl)
  } finally {
    if (typeof originalPage === 'undefined') {
      delete globalThis.Page
    } else {
      globalThis.Page = originalPage
    }
  }

  if (!capturedDefinition) {
    throw new Error('Page definition was not registered by page/game.js.')
  }

  return capturedDefinition
}

function getVisibleWidgets(createdWidgets, type) {
  return createdWidgets.filter((widget) => widget.type === type && !widget.deleted)
}

function getWidgetRect(widget) {
  const { x, y, w, h } = widget.properties

  return { x, y, w, h }
}

function hasVisibleRect(widget) {
  const { w, h } = getWidgetRect(widget)

  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
}

function isBackgroundFillRect(widget, width, height) {
  if (widget.type !== 'FILL_RECT') {
    return false
  }

  const { x, y, w, h } = getWidgetRect(widget)

  return x === 0 && y === 0 && w === width && h === height
}

function assertWidgetWithinScreen(widget, width, height) {
  const { x, y, w, h } = getWidgetRect(widget)

  assert.equal(Number.isFinite(x), true)
  assert.equal(Number.isFinite(y), true)
  assert.equal(Number.isFinite(w), true)
  assert.equal(Number.isFinite(h), true)
  assert.equal(w > 0, true)
  assert.equal(h > 0, true)
  assert.equal(x >= 0, true)
  assert.equal(y >= 0, true)
  assert.equal(x + w <= width, true)
  assert.equal(y + h <= height, true)
}

function getRoundHorizontalBounds(width, height, yPosition) {
  const radius = Math.min(width, height) / 2
  const centerX = width / 2
  const centerY = height / 2
  const boundedY = Math.min(Math.max(yPosition, 0), height)
  const distanceFromCenter = Math.abs(boundedY - centerY)
  const halfChord = Math.sqrt(Math.max(0, radius * radius - distanceFromCenter * distanceFromCenter))

  return {
    left: centerX - halfChord,
    right: centerX + halfChord
  }
}

function assertWidgetWithinRoundScreen(widget, width, height) {
  const { x, y, w, h } = getWidgetRect(widget)
  const yPositions = [y, y + h / 2, y + h]

  yPositions.forEach((yPosition) => {
    const { left, right } = getRoundHorizontalBounds(width, height, yPosition)

    assert.equal(x >= left - 1, true)
    assert.equal(x + w <= right + 1, true)
  })
}

async function renderGameScreenForDimensions(width, height) {
  return runWithRenderedGamePage(width, height, ({ createdWidgets }) => ({
    createdWidgets,
    width,
    height
  }))
}

async function runWithRenderedGamePage(width, height, runScenario) {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalGetApp = globalThis.getApp

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const app = {
    globalData: {
      matchState: createInitialMatchState(1700000000),
      matchHistory: createHistoryStack()
    }
  }

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width, height }
    }
  }
  globalThis.getApp = () => app

  try {
    const definition = await loadGamePageDefinition()
    const page = createPageInstance(definition)

    page.onInit()
    page.build()

    return runScenario({
      app,
      createdWidgets,
      page,
      width,
      height
    })
  } finally {
    if (typeof originalHmUI === 'undefined') {
      delete globalThis.hmUI
    } else {
      globalThis.hmUI = originalHmUI
    }

    if (typeof originalHmSetting === 'undefined') {
      delete globalThis.hmSetting
    } else {
      globalThis.hmSetting = originalHmSetting
    }

    if (typeof originalGetApp === 'undefined') {
      delete globalThis.getApp
    } else {
      globalThis.getApp = originalGetApp
    }
  }
}

function findButtonByText(buttons, text) {
  return buttons.find((button) => button.properties.text === text)
}

function isNumericText(value) {
  return typeof value === 'string' && /^[0-9]+$/.test(value)
}

function getRenderedScoreTextValues(createdWidgets) {
  const textWidgets = getVisibleWidgets(createdWidgets, 'TEXT').filter(hasVisibleRect)
  const setScoreWidgets = textWidgets
    .filter((widget) => isNumericText(widget.properties.text))
    .sort((left, right) => left.properties.x - right.properties.x)
  const gamePointsWidget = textWidgets.find(
    (widget) =>
      typeof widget.properties.text === 'string' &&
      widget.properties.text.includes(' - ')
  )

  assert.equal(setScoreWidgets.length >= 2, true)
  assert.equal(Boolean(gamePointsWidget), true)

  return {
    teamASetGames: setScoreWidgets[0].properties.text,
    teamBSetGames: setScoreWidgets[1].properties.text,
    gamePoints: gamePointsWidget.properties.text
  }
}

function assertRenderedScoresMatchState(createdWidgets, matchState) {
  const viewModel = createScoreViewModel(matchState)
  const renderedScores = getRenderedScoreTextValues(createdWidgets)

  assert.deepEqual(renderedScores, {
    teamASetGames: String(viewModel.currentSetGames.teamA),
    teamBSetGames: String(viewModel.currentSetGames.teamB),
    gamePoints: `${viewModel.teamA.points} - ${viewModel.teamB.points}`
  })
}

test('game screen keeps set, points, and controls in top-to-bottom layout order', async () => {
  const { createdWidgets } = await renderGameScreenForDimensions(390, 450)
  const fillRects = getVisibleWidgets(createdWidgets, 'FILL_RECT')
  const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')

  const sectionCards = fillRects
    .filter((widget) => widget.properties.x !== 0 || widget.properties.y !== 0)
    .sort((left, right) => left.properties.y - right.properties.y)

  assert.equal(sectionCards.length, 2)
  assert.equal(buttons.length, 5)

  const setSectionBottom = sectionCards[0].properties.y + sectionCards[0].properties.h
  const pointsSectionTop = sectionCards[1].properties.y
  const pointsSectionBottom = sectionCards[1].properties.y + sectionCards[1].properties.h
  const controlsTop = Math.min(...buttons.map((button) => button.properties.y))

  assert.equal(setSectionBottom <= pointsSectionTop, true)
  assert.equal(pointsSectionBottom <= controlsTop, true)
})

test('game controls keep key visible widgets in bounds for square and round screens', async () => {
  const screenScenarios = [
    { width: 390, height: 450 },
    { width: 390, height: 390 },
    { width: 454, height: 454 }
  ]

  for (const scenario of screenScenarios) {
    const { createdWidgets, width, height } = await renderGameScreenForDimensions(
      scenario.width,
      scenario.height
    )
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const visibleTextWidgets = getVisibleWidgets(createdWidgets, 'TEXT').filter(hasVisibleRect)
    const visibleForegroundFillRects = getVisibleWidgets(createdWidgets, 'FILL_RECT').filter(
      (widget) => hasVisibleRect(widget) && !isBackgroundFillRect(widget, width, height)
    )
    const widgetsWithBoundsChecks = [
      ...buttons,
      ...visibleTextWidgets,
      ...visibleForegroundFillRects
    ]

    assert.equal(buttons.length, 5)
    assert.equal(visibleTextWidgets.length > 0, true)
    assert.equal(visibleForegroundFillRects.length > 0, true)

    widgetsWithBoundsChecks.forEach((widget) => {
      assertWidgetWithinScreen(widget, width, height)
    })
  }
})

test('game top and middle sections stay inside round-screen horizontal safe area', async () => {
  const { createdWidgets, width, height } = await renderGameScreenForDimensions(454, 454)
  const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
  const controlsTop = Math.min(...buttons.map((button) => button.properties.y))
  const safeSectionFillRects = getVisibleWidgets(createdWidgets, 'FILL_RECT').filter(
    (widget) =>
      hasVisibleRect(widget) &&
      !isBackgroundFillRect(widget, width, height) &&
      widget.properties.y + widget.properties.h <= controlsTop
  )
  const safeSectionTexts = getVisibleWidgets(createdWidgets, 'TEXT').filter(
    (widget) => hasVisibleRect(widget) && widget.properties.y + widget.properties.h <= controlsTop
  )

  assert.equal(safeSectionFillRects.length, 2)
  assert.equal(safeSectionTexts.length > 0, true)

  const widgetsToValidate = [...safeSectionFillRects, ...safeSectionTexts]

  widgetsToValidate.forEach((widget) => {
    assertWidgetWithinRoundScreen(widget, width, height)
  })
})

test('game screen renders expected bottom control button labels', async () => {
  const { createdWidgets } = await renderGameScreenForDimensions(390, 450)
  const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
  const labels = buttons.map((button) => button.properties.text)

  assert.deepEqual(labels, [
    'game.teamAAddPoint',
    'game.teamBAddPoint',
    'game.teamARemovePoint',
    'game.teamBRemovePoint',
    'game.backHome'
  ])
})

test('game screen controls call team-specific handlers for add and remove', async () => {
  await runWithRenderedGamePage(390, 450, ({ createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')
    const addTeamBButton = findButtonByText(buttons, 'game.teamBAddPoint')
    const removeTeamAButton = findButtonByText(buttons, 'game.teamARemovePoint')
    const removeTeamBButton = findButtonByText(buttons, 'game.teamBRemovePoint')
    const backHomeButton = findButtonByText(buttons, 'game.backHome')
    const calls = []

    assert.equal(typeof addTeamAButton?.properties.click_func, 'function')
    assert.equal(typeof addTeamBButton?.properties.click_func, 'function')
    assert.equal(typeof removeTeamAButton?.properties.click_func, 'function')
    assert.equal(typeof removeTeamBButton?.properties.click_func, 'function')
    assert.equal(typeof backHomeButton?.properties.click_func, 'function')

    page.handleAddPointForTeam = (team) => {
      calls.push(`add:${team}`)
    }

    page.handleRemovePointForTeam = (team) => {
      calls.push(`remove:${team}`)
    }

    page.handleBackToHome = () => {
      calls.push('home:back')
    }

    addTeamAButton.properties.click_func()
    addTeamBButton.properties.click_func()
    removeTeamAButton.properties.click_func()
    removeTeamBButton.properties.click_func()
    backHomeButton.properties.click_func()

    assert.deepEqual(calls, ['add:teamA', 'add:teamB', 'remove:teamA', 'remove:teamB', 'home:back'])
  })
})

test('game back-home control saves state before navigating with goBack', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  const originalHmApp = globalThis.hmApp
  const callOrder = []
  let persistedStatePayload = null

  globalThis.settingsStorage = {
    setItem(_key, value) {
      callOrder.push('save')
      persistedStatePayload = value
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  globalThis.hmApp = {
    goBack() {
      callOrder.push('goBack')
    },
    gotoPage() {
      callOrder.push('gotoPage')
    }
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ app, createdWidgets }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const backHomeButton = findButtonByText(buttons, 'game.backHome')

      assert.equal(typeof backHomeButton?.properties.click_func, 'function')

      backHomeButton.properties.click_func()

      assert.equal(typeof persistedStatePayload, 'string')
      assert.deepEqual(JSON.parse(persistedStatePayload), app.globalData.matchState)
      assert.deepEqual(callOrder, ['save', 'goBack'])
    })
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }

    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('game back-home control falls back to home route when goBack is unavailable', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  const originalHmApp = globalThis.hmApp
  const callOrder = []

  globalThis.settingsStorage = {
    setItem() {
      callOrder.push('save')
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  globalThis.hmApp = {
    gotoPage(options) {
      callOrder.push(`goto:${options?.url ?? ''}`)
    }
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ createdWidgets }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const backHomeButton = findButtonByText(buttons, 'game.backHome')

      assert.equal(typeof backHomeButton?.properties.click_func, 'function')

      backHomeButton.properties.click_func()

      assert.deepEqual(callOrder, ['save', 'goto:page/index'])
    })
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }

    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('game lifecycle auto-save persists runtime state on hide and destroy', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  const persistedPayloads = []

  globalThis.settingsStorage = {
    setItem(_key, value) {
      persistedPayloads.push(value)
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ app, page }) => {
      page.onHide()
      page.onDestroy()

      assert.equal(persistedPayloads.length, 2)
      assert.deepEqual(JSON.parse(persistedPayloads[0]), app.globalData.matchState)
      assert.deepEqual(JSON.parse(persistedPayloads[1]), app.globalData.matchState)
    })
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }
})

test('game lifecycle auto-save is a no-op when runtime match state is invalid', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  let saveCallCount = 0

  globalThis.settingsStorage = {
    setItem() {
      saveCallCount += 1
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ app, page }) => {
      app.globalData.matchState = null

      assert.equal(page.handleLifecycleAutoSave(), false)

      page.onHide()
      page.onDestroy()

      assert.equal(saveCallCount, 0)
    })
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }
})

test('team-specific remove buttons remove latest point scored by selected team', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')
    const addTeamBButton = findButtonByText(buttons, 'game.teamBAddPoint')
    const removeTeamAButton = findButtonByText(buttons, 'game.teamARemovePoint')
    const removeTeamBButton = findButtonByText(buttons, 'game.teamBRemovePoint')

    assertRenderedScoresMatchState(createdWidgets, app.globalData.matchState)

    addTeamAButton.properties.click_func()
    assertRenderedScoresMatchState(createdWidgets, app.globalData.matchState)

    addTeamBButton.properties.click_func()
    assertRenderedScoresMatchState(createdWidgets, app.globalData.matchState)

    addTeamAButton.properties.click_func()
    assertRenderedScoresMatchState(createdWidgets, app.globalData.matchState)

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.THIRTY)
    assert.equal(app.globalData.matchState.teamB.points, SCORE_POINTS.FIFTEEN)

    removeTeamBButton.properties.click_func()
    assertRenderedScoresMatchState(createdWidgets, app.globalData.matchState)

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.THIRTY)
    assert.equal(app.globalData.matchState.teamB.points, SCORE_POINTS.LOVE)
    assert.equal(app.globalData.matchHistory.size(), 2)

    removeTeamAButton.properties.click_func()
    assertRenderedScoresMatchState(createdWidgets, app.globalData.matchState)

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.FIFTEEN)
    assert.equal(app.globalData.matchState.teamB.points, SCORE_POINTS.LOVE)
    assert.equal(app.globalData.matchHistory.size(), 1)
  })
})

test('game controls update visible game and set scores after winning a game', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')

    assertRenderedScoresMatchState(createdWidgets, app.globalData.matchState)

    for (let index = 0; index < 4; index += 1) {
      addTeamAButton.properties.click_func()
      assertRenderedScoresMatchState(createdWidgets, app.globalData.matchState)
    }

    assert.equal(app.globalData.matchState.currentSetStatus.teamAGames, 1)
    assert.equal(app.globalData.matchState.currentSetStatus.teamBGames, 0)
    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.LOVE)
    assert.equal(app.globalData.matchState.teamB.points, SCORE_POINTS.LOVE)
  })
})

test('game scoring updates runtime state, rerenders UI, and then persists', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  const interactionEvents = []
  let persistedStatePayload = null

  globalThis.settingsStorage = {
    setItem(_key, value) {
      interactionEvents.push('save')
      persistedStatePayload = value
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')

      const originalUpdateRuntimeMatchState = page.updateRuntimeMatchState.bind(page)
      const originalRenderGameScreen = page.renderGameScreen.bind(page)

      page.updateRuntimeMatchState = (nextState) => {
        interactionEvents.push('update')
        return originalUpdateRuntimeMatchState(nextState)
      }

      page.renderGameScreen = () => {
        interactionEvents.push('render')
        return originalRenderGameScreen()
      }

      addTeamAButton.properties.click_func()

      assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.FIFTEEN)
      assert.equal(typeof persistedStatePayload, 'string')
      assert.deepEqual(JSON.parse(persistedStatePayload), app.globalData.matchState)
      assert.deepEqual(interactionEvents.slice(-3), ['update', 'render', 'save'])
    })
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }
})

test('game interaction performance metrics cover realistic add/remove flow under target budget', async () => {
  await runWithRenderedGamePage(390, 450, ({ createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')
    const addTeamBButton = findButtonByText(buttons, 'game.teamBAddPoint')
    const removeTeamBButton = findButtonByText(buttons, 'game.teamBRemovePoint')
    const timeSamples = [1000, 1012, 1044, 2000, 2016, 2052, 3000, 3018, 3070]
    const measuredMetrics = []

    page.getCurrentTimeMs = () => timeSamples.shift()
    page.onInteractionPerformanceMeasured = (metrics) => {
      measuredMetrics.push(metrics)
    }

    addTeamAButton.properties.click_func()
    addTeamBButton.properties.click_func()
    removeTeamBButton.properties.click_func()

    assert.equal(measuredMetrics.length, 3)
    assert.deepEqual(measuredMetrics, [
      {
        interactionLatencyMs: 44,
        renderLatencyMs: 32,
        latencyBudgetMs: 100,
        exceededLatencyBudget: false
      },
      {
        interactionLatencyMs: 52,
        renderLatencyMs: 36,
        latencyBudgetMs: 100,
        exceededLatencyBudget: false
      },
      {
        interactionLatencyMs: 70,
        renderLatencyMs: 52,
        latencyBudgetMs: 100,
        exceededLatencyBudget: false
      }
    ])
    assert.deepEqual(page.lastInteractionPerformanceMetrics, {
      interactionLatencyMs: 70,
      renderLatencyMs: 52,
      latencyBudgetMs: 100,
      exceededLatencyBudget: false
    })
  })
})

test('game interaction performance metrics flag over-budget high-history team remove path', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')
    const addTeamBButton = findButtonByText(buttons, 'game.teamBAddPoint')
    const removeTeamAButton = findButtonByText(buttons, 'game.teamARemovePoint')
    const highHistoryInteractionCount = 48

    for (let index = 0; index < highHistoryInteractionCount; index += 1) {
      const addButton = index % 2 === 0 ? addTeamAButton : addTeamBButton
      addButton.properties.click_func()
    }

    const historyDepthBeforeRemove = app.globalData.matchHistory.size()

    assert.equal(historyDepthBeforeRemove >= highHistoryInteractionCount, true)

    const timeSamples = [2000, 2105, 2140]
    const measuredMetrics = []

    page.getCurrentTimeMs = () => timeSamples.shift()
    page.onInteractionPerformanceMeasured = (metrics) => {
      measuredMetrics.push(metrics)
    }

    removeTeamAButton.properties.click_func()

    assert.equal(measuredMetrics.length, 1)
    assert.equal(measuredMetrics[0].interactionLatencyMs, 140)
    assert.equal(measuredMetrics[0].latencyBudgetMs, 100)
    assert.equal(measuredMetrics[0].exceededLatencyBudget, true)
    assert.equal(page.lastInteractionPerformanceMetrics.exceededLatencyBudget, true)
    assert.equal(app.globalData.matchHistory.size(), historyDepthBeforeRemove - 1)
    assertRenderedScoresMatchState(createdWidgets, app.globalData.matchState)
  })
})
