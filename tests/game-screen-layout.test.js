import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

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

test('game screen keeps set, points, and controls in top-to-bottom layout order', async () => {
  const { createdWidgets } = await renderGameScreenForDimensions(390, 450)
  const fillRects = getVisibleWidgets(createdWidgets, 'FILL_RECT')
  const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')

  const sectionCards = fillRects
    .filter((widget) => widget.properties.x !== 0 || widget.properties.y !== 0)
    .sort((left, right) => left.properties.y - right.properties.y)

  assert.equal(sectionCards.length, 2)
  assert.equal(buttons.length, 4)

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

    assert.equal(buttons.length, 4)
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
    'game.teamBRemovePoint'
  ])
})

test('game screen remove controls call team-specific handlers', async () => {
  await runWithRenderedGamePage(390, 450, ({ createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const removeTeamAButton = findButtonByText(buttons, 'game.teamARemovePoint')
    const removeTeamBButton = findButtonByText(buttons, 'game.teamBRemovePoint')
    const calls = []

    assert.equal(typeof removeTeamAButton?.properties.click_func, 'function')
    assert.equal(typeof removeTeamBButton?.properties.click_func, 'function')

    page.handleRemovePointForTeam = (team) => {
      calls.push(team)
    }

    removeTeamAButton.properties.click_func()
    removeTeamBButton.properties.click_func()

    assert.deepEqual(calls, ['teamA', 'teamB'])
  })
})

test('team-specific remove buttons remove latest point scored by selected team', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')
    const addTeamBButton = findButtonByText(buttons, 'game.teamBAddPoint')
    const removeTeamAButton = findButtonByText(buttons, 'game.teamARemovePoint')
    const removeTeamBButton = findButtonByText(buttons, 'game.teamBRemovePoint')

    addTeamAButton.properties.click_func()
    addTeamBButton.properties.click_func()
    addTeamAButton.properties.click_func()

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.THIRTY)
    assert.equal(app.globalData.matchState.teamB.points, SCORE_POINTS.FIFTEEN)

    removeTeamBButton.properties.click_func()

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.THIRTY)
    assert.equal(app.globalData.matchState.teamB.points, SCORE_POINTS.LOVE)
    assert.equal(app.globalData.matchHistory.size(), 2)

    removeTeamAButton.properties.click_func()

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.FIFTEEN)
    assert.equal(app.globalData.matchState.teamB.points, SCORE_POINTS.LOVE)
    assert.equal(app.globalData.matchHistory.size(), 1)
  })
})
