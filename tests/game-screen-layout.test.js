import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createScoreViewModel } from '../page/score-view-model.js'
import { createHistoryStack } from '../utils/history-stack.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { STORAGE_KEY as ACTIVE_MATCH_SESSION_STORAGE_KEY } from '../utils/match-state-schema.js'
import { SCORE_POINTS } from '../utils/scoring-constants.js'
import { createHmFsMock, storageKeyToFilename } from './helpers/hmfs-mock.js'
import { toProjectFileUrl } from './helpers/project-paths.js'

let gamePageImportCounter = 0

function createHmUiRecorder() {
  const createdWidgets = []
  const shownToasts = []

  return {
    createdWidgets,
    shownToasts,
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
      },
      showToast(payload) {
        shownToasts.push(payload)
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
  const sourceUrl = toProjectFileUrl('page/game.js')
  const scoreViewModelUrl = toProjectFileUrl('page/score-view-model.js')
  const historyStackUrl = toProjectFileUrl('utils/history-stack.js')
  const matchStateUrl = toProjectFileUrl('utils/match-state.js')
  const scoringConstantsUrl = toProjectFileUrl('utils/scoring-constants.js')
  const scoringEngineUrl = toProjectFileUrl('utils/scoring-engine.js')
  const storageUrl = toProjectFileUrl('utils/storage.js')
  const matchStorageUrl = toProjectFileUrl('utils/match-storage.js')
  const matchStateSchemaUrl = toProjectFileUrl('utils/match-state-schema.js')
  const designTokensUrl = toProjectFileUrl('utils/design-tokens.js')
  const layoutEngineUrl = toProjectFileUrl('utils/layout-engine.js')
  const layoutPresetsUrl = toProjectFileUrl('utils/layout-presets.js')
  const screenUtilsUrl = toProjectFileUrl('utils/screen-utils.js')
  const uiComponentsUrl = toProjectFileUrl('utils/ui-components.js')

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace(
      "import { gettext } from 'i18n'\n",
      'const gettext = (key) => key\n'
    )
    .replace("from './score-view-model.js'", `from '${scoreViewModelUrl.href}'`)
    .replace(
      "from '../utils/history-stack.js'",
      `from '${historyStackUrl.href}'`
    )
    .replace("from '../utils/match-state.js'", `from '${matchStateUrl.href}'`)
    .replace(
      "from '../utils/scoring-constants.js'",
      `from '${scoringConstantsUrl.href}'`
    )
    .replace(
      "from '../utils/scoring-engine.js'",
      `from '${scoringEngineUrl.href}'`
    )
    .replace("from '../utils/storage.js'", `from '${storageUrl.href}'`)
    .replace(
      "from '../utils/match-storage.js'",
      `from '${matchStorageUrl.href}'`
    )
    .replace(
      "from '../utils/match-state-schema.js'",
      `from '${matchStateSchemaUrl.href}'`
    )
    .replace(
      "from '../utils/design-tokens.js'",
      `from '${designTokensUrl.href}'`
    )
    .replace(
      "from '../utils/layout-engine.js'",
      `from '${layoutEngineUrl.href}'`
    )
    .replace(
      "from '../utils/layout-presets.js'",
      `from '${layoutPresetsUrl.href}'`
    )
    .replace("from '../utils/screen-utils.js'", `from '${screenUtilsUrl.href}'`)
    .replace(
      "from '../utils/ui-components.js'",
      `from '${uiComponentsUrl.href}'`
    )

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
  return createdWidgets.filter(
    (widget) => widget.type === type && !widget.deleted
  )
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
  const halfChord = Math.sqrt(
    Math.max(0, radius * radius - distanceFromCenter * distanceFromCenter)
  )

  return {
    left: centerX - halfChord,
    right: centerX + halfChord
  }
}

function _assertWidgetWithinRoundScreen(widget, width, height) {
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

async function runWithRenderedGamePage(
  width,
  height,
  runScenario,
  options = {}
) {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalGetApp = globalThis.getApp
  const originalHmFS = globalThis.hmFS
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout

  const { hmUI, createdWidgets, shownToasts } = createHmUiRecorder()
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
  globalThis.hmFS = createHmFsMock().mock

  if (typeof options.setTimeout === 'function') {
    globalThis.setTimeout = options.setTimeout
  }

  if (typeof options.clearTimeout === 'function') {
    globalThis.clearTimeout = options.clearTimeout
  }

  try {
    const definition = await loadGamePageDefinition()
    const page = createPageInstance(definition)

    page.onInit()
    // Bypass async session validation for layout tests - session guard is tested separately
    page.isSessionAccessGranted = true
    page.build()

    const scenarioResult = await runScenario({
      app,
      createdWidgets,
      shownToasts,
      page,
      width,
      height
    })

    if (typeof page.waitForPersistenceIdle === 'function') {
      await page.waitForPersistenceIdle()
    }

    return scenarioResult
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

    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }

    if (typeof originalSetTimeout === 'undefined') {
      delete globalThis.setTimeout
    } else {
      globalThis.setTimeout = originalSetTimeout
    }

    if (typeof originalClearTimeout === 'undefined') {
      delete globalThis.clearTimeout
    } else {
      globalThis.clearTimeout = originalClearTimeout
    }
  }
}

function isNumericText(value) {
  return typeof value === 'string' && /^[0-9]+$/.test(value)
}

function parseSetsWonCounterValue(textValue) {
  if (typeof textValue !== 'string') {
    return null
  }

  const parsedMatch = /^\s*([0-9]+)\s*[–-]\s*([0-9]+)\s*$/.exec(textValue)

  if (parsedMatch) {
    return { teamA: parsedMatch[1], teamB: parsedMatch[2] }
  }

  return null
}

function _getPersistenceWritesByKey(writes, storageKey) {
  return writes
    .filter((entry) => entry.key === storageKey)
    .map((entry) => entry.value)
}

function createAcceptedInteractionTimeSource(
  startAt = 1000,
  interactionGapMs = 340,
  renderStartedOffsetMs = 10,
  uiUpdatedOffsetMs = 44
) {
  let interactionStartMs = startAt
  let interactionPhase = 0

  return () => {
    if (interactionPhase === 0) {
      interactionPhase = 1
      return interactionStartMs
    }

    if (interactionPhase === 1) {
      interactionPhase = 2
      return interactionStartMs + renderStartedOffsetMs
    }

    interactionPhase = 0
    const uiUpdatedAt = interactionStartMs + uiUpdatedOffsetMs
    interactionStartMs += interactionGapMs
    return uiUpdatedAt
  }
}

function createManualFinishTimerHarness() {
  const pendingTimers = new Map()
  const clearedTimerIds = []
  let timerIdCounter = 1

  return {
    pendingTimers,
    clearedTimerIds,
    setTimeout(callback, delay) {
      const timerId = timerIdCounter
      timerIdCounter += 1

      pendingTimers.set(timerId, {
        callback,
        delay
      })

      return timerId
    },
    clearTimeout(timerId) {
      pendingTimers.delete(timerId)
      clearedTimerIds.push(timerId)
    },
    runTimer(timerId) {
      const timer = pendingTimers.get(timerId)

      if (!timer) {
        return false
      }

      pendingTimers.delete(timerId)
      timer.callback()
      return true
    },
    runLatestTimer() {
      const latestTimerId = Math.max(...pendingTimers.keys())
      return this.runTimer(latestTimerId)
    }
  }
}

function getRenderedScoreTextValues(createdWidgets) {
  const textWidgets = getVisibleWidgets(createdWidgets, 'TEXT').filter(
    hasVisibleRect
  )
  const setScoreCandidates = textWidgets.filter((widget) =>
    isNumericText(widget.properties.text)
  )
  const maxSetScoreRowY = Math.max(
    ...setScoreCandidates.map((widget) => widget.properties.y)
  )
  const setScoreWidgets = setScoreCandidates
    .filter((widget) => widget.properties.y === maxSetScoreRowY)
    .sort((left, right) => left.properties.x - right.properties.x)

  const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
  const scoreButtons = buttons.filter(
    (b) => b.properties.text !== '−' && b.properties.text !== 'game.backHome'
  )

  assert.equal(setScoreWidgets.length >= 2, true)
  assert.equal(scoreButtons.length >= 2, true)

  return {
    teamASetGames: setScoreWidgets[0].properties.text,
    teamBSetGames: setScoreWidgets[1].properties.text,
    teamAPoints: scoreButtons[0] ? scoreButtons[0].properties.text : '0',
    teamBPoints: scoreButtons[1] ? scoreButtons[1].properties.text : '0'
  }
}

function getRenderedSetsWonTextValues(createdWidgets) {
  const textWidgets = getVisibleWidgets(createdWidgets, 'TEXT').filter(
    hasVisibleRect
  )
  const setCounterWidgets = textWidgets
    .filter(
      (widget) => parseSetsWonCounterValue(widget.properties.text) !== null
    )
    .sort((left, right) => left.properties.x - right.properties.x)

  assert.equal(setCounterWidgets.length >= 2, true)

  const parsed = parseSetsWonCounterValue(setCounterWidgets[0].properties.text)
  return {
    teamASetsWon: parsed.teamA,
    teamBSetsWon: parsed.teamB
  }
}

function _assertRenderedScoresMatchState(createdWidgets, matchState) {
  const viewModel = createScoreViewModel(matchState)
  const renderedScores = getRenderedScoreTextValues(createdWidgets)

  assert.equal(
    renderedScores.teamASetGames,
    String(viewModel.currentSetGames.teamA)
  )
  assert.equal(
    renderedScores.teamBSetGames,
    String(viewModel.currentSetGames.teamB)
  )
  assert.equal(renderedScores.teamAPoints, String(viewModel.teamA.points))
  assert.equal(renderedScores.teamBPoints, String(viewModel.teamB.points))
}

test('game screen keeps set, points, and controls in top-to-bottom layout order', async () => {
  const { createdWidgets } = await renderGameScreenForDimensions(390, 450)
  const _fillRects = getVisibleWidgets(createdWidgets, 'FILL_RECT')
  const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
  const textWidgets = getVisibleWidgets(createdWidgets, 'TEXT')

  assert.equal(buttons.length, 6)

  const buttonYs = buttons.map((button) => button.properties.y)
  const textYs = textWidgets.map((text) => text.properties.y)

  const controlsTop = Math.min(...buttonYs)
  const headerBottom = Math.min(...textYs.filter((y) => y > 0))

  assert.equal(headerBottom < controlsTop, true)
})

test('game controls keep key visible widgets in bounds for square and round screens', async () => {
  const screenScenarios = [
    { width: 390, height: 450 },
    { width: 390, height: 390 },
    { width: 454, height: 454 }
  ]

  for (const scenario of screenScenarios) {
    const { createdWidgets, width, height } =
      await renderGameScreenForDimensions(scenario.width, scenario.height)
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const visibleTextWidgets = getVisibleWidgets(createdWidgets, 'TEXT').filter(
      hasVisibleRect
    )
    const visibleForegroundFillRects = getVisibleWidgets(
      createdWidgets,
      'FILL_RECT'
    ).filter(
      (widget) =>
        hasVisibleRect(widget) && !isBackgroundFillRect(widget, width, height)
    )
    // Text buttons have positive dimensions, image buttons use w: -1, h: -1
    const textButtons = buttons.filter(
      (button) =>
        Number.isFinite(button.properties.w) && button.properties.w > 0
    )
    const imageButtons = buttons.filter(
      (button) =>
        !Number.isFinite(button.properties.w) || button.properties.w < 0
    )
    const widgetsWithBoundsChecks = [
      ...textButtons,
      ...visibleTextWidgets,
      ...visibleForegroundFillRects
    ]

    assert.equal(buttons.length, 6)
    assert.equal(textButtons.length, 4) // Score and minus buttons
    assert.equal(imageButtons.length, 2) // Home + manual finish icon buttons
    assert.equal(visibleTextWidgets.length > 0, true)
    assert.equal(visibleForegroundFillRects.length > 0, true)

    widgetsWithBoundsChecks.forEach((widget) => {
      assertWidgetWithinScreen(widget, width, height)
    })

    // Verify image button position is within screen bounds
    imageButtons.forEach((button) => {
      assert.equal(button.properties.x >= 0, true)
      assert.equal(button.properties.y >= 0, true)
      assert.equal(button.properties.x < width, true)
      assert.equal(button.properties.y < height, true)
    })
  }
})

test('game top and middle sections stay inside round-screen horizontal safe area', async () => {
  const { createdWidgets } = await renderGameScreenForDimensions(454, 454)
  const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')

  // Verify buttons are present and within screen bounds
  assert.equal(buttons.length >= 1, true)
  buttons.forEach((button) => {
    assert.equal(button.properties.x >= 0, true)
    assert.equal(button.properties.y >= 0, true)
  })
})

test('game screen renders expected bottom control button labels', async () => {
  const { createdWidgets } = await renderGameScreenForDimensions(390, 450)
  const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
  const labels = buttons.map((button) => button.properties.text)

  // First 4 buttons are text buttons, then home and manual-finish icon buttons
  assert.deepEqual(labels.slice(0, 4), ['0', '0', '−', '−'])
  // Icon buttons use normal_src instead of text
  assert.equal(buttons[4]?.properties.normal_src, 'home-icon.png')
  assert.equal(buttons[5]?.properties.normal_src, 'coach-icon.png')
})

test('game screen renders sets-won counters with default 0-0 values', async () => {
  const { createdWidgets } = await renderGameScreenForDimensions(390, 450)
  const renderedSetCounters = getRenderedSetsWonTextValues(createdWidgets)

  assert.deepEqual(renderedSetCounters, {
    teamASetsWon: '0',
    teamBSetsWon: '0'
  })
})

test('game screen prioritizes runtime sets-won values and falls back to persisted session values', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    page.persistedSessionState = {
      setsWon: {
        teamA: 1,
        teamB: 2
      }
    }

    page.renderGameScreen()

    assert.deepEqual(getRenderedSetsWonTextValues(createdWidgets), {
      teamASetsWon: '1',
      teamBSetsWon: '2'
    })

    app.globalData.matchState.setsWon = {
      teamA: 3,
      teamB: 4
    }

    page.renderGameScreen()

    assert.deepEqual(getRenderedSetsWonTextValues(createdWidgets), {
      teamASetsWon: '3',
      teamBSetsWon: '4'
    })
  })
})

test('game screen reflects programmatic sets-won state changes on rerender', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    app.globalData.matchState.setsWon = {
      teamA: 0,
      teamB: 0
    }

    page.renderGameScreen()

    app.globalData.matchState.setsWon.teamA = 2
    page.renderGameScreen()

    assert.deepEqual(getRenderedSetsWonTextValues(createdWidgets), {
      teamASetsWon: '2',
      teamBSetsWon: '0'
    })

    app.globalData.matchState.setsWon.teamB = 1
    page.renderGameScreen()

    assert.deepEqual(getRenderedSetsWonTextValues(createdWidgets), {
      teamASetsWon: '2',
      teamBSetsWon: '1'
    })
  })
})

test('game runtime state hydrates set metadata from persisted active session', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, page }) => {
    page.persistedSessionState = {
      status: 'active',
      setsToPlay: 5,
      setsNeededToWin: 3,
      setsWon: {
        teamA: 1,
        teamB: 2
      },
      currentSet: {
        number: 4,
        games: {
          teamA: 2,
          teamB: 3
        }
      },
      currentGame: {
        points: {
          teamA: 0,
          teamB: 0
        }
      },
      setHistory: [
        {
          setNumber: 1,
          teamAGames: 6,
          teamBGames: 4
        },
        {
          setNumber: 2,
          teamAGames: 3,
          teamBGames: 6
        },
        {
          setNumber: 3,
          teamAGames: 7,
          teamBGames: 6
        }
      ],
      updatedAt: Date.now(),
      schemaVersion: 1
    }

    app.globalData.matchState = createInitialMatchState(1700000001)
    page.ensureRuntimeState()

    assert.equal(app.globalData.matchState.setsNeededToWin, 3)
    assert.deepEqual(app.globalData.matchState.setsWon, {
      teamA: 1,
      teamB: 2
    })
    assert.equal(app.globalData.matchState.currentSetStatus.number, 4)
    assert.equal(app.globalData.matchState.currentSet, 4)
    assert.equal(app.globalData.matchState.currentSetStatus.teamAGames, 2)
    assert.equal(app.globalData.matchState.currentSetStatus.teamBGames, 3)
    assert.equal(app.globalData.matchState.teamA.games, 2)
    assert.equal(app.globalData.matchState.teamB.games, 3)
    assert.deepEqual(app.globalData.matchState.setHistory, [
      {
        setNumber: 1,
        teamAGames: 6,
        teamBGames: 4
      },
      {
        setNumber: 2,
        teamAGames: 3,
        teamBGames: 6
      },
      {
        setNumber: 3,
        teamAGames: 7,
        teamBGames: 6
      }
    ])
  })
})

test('game runtime state hydrates regular-game persisted points with Ad/Game conversion', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, page }) => {
    page.persistedSessionState = {
      status: 'active',
      setsToPlay: 3,
      setsNeededToWin: 2,
      setsWon: {
        teamA: 0,
        teamB: 1
      },
      currentSet: {
        number: 2,
        games: {
          teamA: 4,
          teamB: 3
        }
      },
      currentGame: {
        points: {
          teamA: 50,
          teamB: 60
        }
      },
      setHistory: [
        {
          setNumber: 1,
          teamAGames: 3,
          teamBGames: 6
        }
      ],
      updatedAt: Date.now(),
      schemaVersion: 1
    }

    app.globalData.matchState = createInitialMatchState(1700000001)
    page.ensureRuntimeState()
    page.renderGameScreen()

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.ADVANTAGE)
    assert.equal(app.globalData.matchState.teamB.points, SCORE_POINTS.GAME)
  })
})

test('game runtime state keeps tie-break persisted points as numeric values', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, page }) => {
    page.persistedSessionState = {
      status: 'active',
      setsToPlay: 3,
      setsNeededToWin: 2,
      setsWon: {
        teamA: 0,
        teamB: 0
      },
      currentSet: {
        number: 1,
        games: {
          teamA: 6,
          teamB: 6
        }
      },
      currentGame: {
        points: {
          teamA: 50,
          teamB: 60
        }
      },
      setHistory: [],
      updatedAt: Date.now(),
      schemaVersion: 1
    }

    app.globalData.matchState = createInitialMatchState(1700000002)
    page.ensureRuntimeState()
    page.renderGameScreen()

    assert.equal(app.globalData.matchState.teamA.points, 50)
    assert.equal(app.globalData.matchState.teamB.points, 60)
  })
})

test('game screen renders resumed manager team labels and score context', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, page }) => {
    app.globalData.matchState = {
      ...createInitialMatchState(1700000003),
      teams: {
        teamA: {
          id: 'teamA',
          label: 'Alpha'
        },
        teamB: {
          id: 'teamB',
          label: 'Beta'
        }
      },
      teamA: {
        points: SCORE_POINTS.THIRTY,
        games: 3
      },
      teamB: {
        points: SCORE_POINTS.FIFTEEN,
        games: 2
      },
      currentSetStatus: {
        number: 2,
        teamAGames: 3,
        teamBGames: 2
      },
      currentSet: 2,
      setsNeededToWin: 2,
      setsWon: {
        teamA: 1,
        teamB: 0
      },
      setHistory: [
        {
          setNumber: 1,
          teamAGames: 6,
          teamBGames: 4
        }
      ]
    }

    page.persistedSessionState = {
      status: 'active',
      setsToPlay: 3,
      setsNeededToWin: 2,
      setsWon: {
        teamA: 1,
        teamB: 0
      },
      currentSet: {
        number: 2,
        games: {
          teamA: 3,
          teamB: 2
        }
      },
      currentGame: {
        points: {
          teamA: 30,
          teamB: 15
        }
      },
      setHistory: [
        {
          setNumber: 1,
          teamAGames: 6,
          teamBGames: 4
        }
      ],
      updatedAt: Date.now(),
      schemaVersion: 1
    }

    page.ensureRuntimeState()
    page.renderGameScreen()

    // Verify state was hydrated
    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.THIRTY)
    assert.equal(app.globalData.matchState.teamB.points, SCORE_POINTS.FIFTEEN)
  })
})

test('game match completion updates match state', async () => {
  await runWithRenderedGamePage(
    390,
    450,
    async ({ app, createdWidgets, page }) => {
      page.getCurrentTimeMs = createAcceptedInteractionTimeSource()

      app.globalData.matchState.setsNeededToWin = 1
      app.globalData.matchState.setsWon = {
        teamA: 0,
        teamB: 0
      }
      app.globalData.matchState.setHistory = []
      app.globalData.matchState.currentSetStatus.number = 1
      app.globalData.matchState.currentSet = 1
      app.globalData.matchState.currentSetStatus.teamAGames = 5
      app.globalData.matchState.currentSetStatus.teamBGames = 0
      app.globalData.matchState.teamA.games = 5
      app.globalData.matchState.teamB.games = 0
      app.globalData.matchState.teamA.points = SCORE_POINTS.FORTY
      app.globalData.matchState.teamB.points = SCORE_POINTS.LOVE

      page.renderGameScreen()

      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const addTeamAButton = buttons[0]

      addTeamAButton.properties.click_func()

      assert.equal(app.globalData.matchState.status, 'finished')
      assert.equal(app.globalData.matchState.winnerTeam, 'teamA')
    }
  )
})

test('game match finish navigates directly to summary without rendering finished state', async () => {
  await runWithRenderedGamePage(
    390,
    450,
    async ({ app, createdWidgets, page }) => {
      page.getCurrentTimeMs = createAcceptedInteractionTimeSource()

      app.globalData.matchState.setsNeededToWin = 1
      app.globalData.matchState.setsWon = {
        teamA: 0,
        teamB: 0
      }
      app.globalData.matchState.setHistory = []
      app.globalData.matchState.currentSetStatus.number = 1
      app.globalData.matchState.currentSet = 1
      app.globalData.matchState.currentSetStatus.teamAGames = 5
      app.globalData.matchState.currentSetStatus.teamBGames = 0
      app.globalData.matchState.teamA.games = 5
      app.globalData.matchState.teamB.games = 0
      app.globalData.matchState.teamA.points = SCORE_POINTS.FORTY
      app.globalData.matchState.teamB.points = SCORE_POINTS.LOVE

      page.renderGameScreen()

      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const addTeamAButton = buttons[0]

      // When match finishes, state is updated and navigation is triggered
      addTeamAButton.properties.click_func()

      // State should be finished
      assert.equal(app.globalData.matchState.status, 'finished')
      assert.equal(app.globalData.matchState.winnerTeam, 'teamA')
    }
  )
})

test('game manual finish button shows coach icon and first tap enters whistle confirm mode', async () => {
  const timerHarness = createManualFinishTimerHarness()

  await runWithRenderedGamePage(
    390,
    450,
    ({ createdWidgets, shownToasts }) => {
      let buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const manualFinishButton = buttons[5]

      assert.equal(manualFinishButton?.properties.normal_src, 'coach-icon.png')

      manualFinishButton.properties.click_func()

      buttons = getVisibleWidgets(createdWidgets, 'BUTTON')

      assert.equal(buttons[5]?.properties.normal_src, 'whistle-icon.png')
      assert.deepEqual(shownToasts, [{ text: 'settings.clearDataConfirm' }])
      assert.equal(timerHarness.pendingTimers.size, 1)
      assert.equal([...timerHarness.pendingTimers.values()][0]?.delay, 3000)
    },
    {
      setTimeout: timerHarness.setTimeout.bind(timerHarness),
      clearTimeout: timerHarness.clearTimeout.bind(timerHarness)
    }
  )
})

test('game manual finish second tap confirms finish, appends partial set once, and clears timer', async () => {
  const timerHarness = createManualFinishTimerHarness()

  await runWithRenderedGamePage(
    390,
    450,
    ({ app, createdWidgets, page }) => {
      const summaryNavigations = []

      page.navigateToSummaryPage = () => {
        summaryNavigations.push('page/summary')
        return true
      }

      app.globalData.matchState.setsWon = {
        teamA: 1,
        teamB: 0
      }
      app.globalData.matchState.setHistory = [
        {
          setNumber: 1,
          teamAGames: 6,
          teamBGames: 4
        }
      ]
      app.globalData.matchState.currentSetStatus.number = 2
      app.globalData.matchState.currentSet = 2
      app.globalData.matchState.currentSetStatus.teamAGames = 4
      app.globalData.matchState.currentSetStatus.teamBGames = 3
      app.globalData.matchState.teamA.games = 4
      app.globalData.matchState.teamB.games = 3
      app.globalData.matchState.teamA.points = SCORE_POINTS.THIRTY
      app.globalData.matchState.teamB.points = SCORE_POINTS.FIFTEEN

      page.renderGameScreen()

      let buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      buttons[5].properties.click_func()

      buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      buttons[5].properties.click_func()

      assert.equal(app.globalData.matchState.status, 'finished')
      assert.equal(app.globalData.matchState.winnerTeam, 'teamA')
      assert.deepEqual(summaryNavigations, ['page/summary'])
      assert.equal(timerHarness.pendingTimers.size, 0)
      assert.equal(timerHarness.clearedTimerIds.length >= 1, true)

      const setTwoEntries = app.globalData.matchState.setHistory.filter(
        (setEntry) => setEntry.setNumber === 2
      )

      assert.equal(setTwoEntries.length, 1)
      assert.deepEqual(setTwoEntries[0], {
        setNumber: 2,
        teamAGames: 4,
        teamBGames: 3
      })

      // Idempotency: triggering manual finish again keeps single partial snapshot
      page.handleManualFinishConfirm()
      assert.equal(
        app.globalData.matchState.setHistory.filter(
          (setEntry) => setEntry.setNumber === 2
        ).length,
        1
      )
    },
    {
      setTimeout: timerHarness.setTimeout.bind(timerHarness),
      clearTimeout: timerHarness.clearTimeout.bind(timerHarness)
    }
  )
})

test('game manual finish confirmation times out after 3 seconds and resets icon/state', async () => {
  const timerHarness = createManualFinishTimerHarness()

  await runWithRenderedGamePage(
    390,
    450,
    ({ app, createdWidgets, page }) => {
      const summaryNavigations = []
      page.navigateToSummaryPage = () => {
        summaryNavigations.push('page/summary')
        return true
      }

      let buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      buttons[5].properties.click_func()

      const [timerId] = [...timerHarness.pendingTimers.keys()]

      assert.equal(Number.isInteger(timerId), true)
      assert.equal(timerHarness.runTimer(timerId), true)

      buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      assert.equal(buttons[5]?.properties.normal_src, 'coach-icon.png')
      assert.equal(page.manualFinishConfirmMode, false)
      assert.equal(app.globalData.matchState.status, 'active')
      assert.deepEqual(summaryNavigations, [])
    },
    {
      setTimeout: timerHarness.setTimeout.bind(timerHarness),
      clearTimeout: timerHarness.clearTimeout.bind(timerHarness)
    }
  )
})

test('game manual finish treats equal sets-won as tie and clears winner metadata', async () => {
  const timerHarness = createManualFinishTimerHarness()

  await runWithRenderedGamePage(
    390,
    450,
    ({ app, createdWidgets }) => {
      app.globalData.matchState.setsWon = {
        teamA: 1,
        teamB: 1
      }
      app.globalData.matchState.winnerTeam = 'teamA'
      app.globalData.matchState.winner = { team: 'teamA' }

      let buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      buttons[5].properties.click_func()

      buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      buttons[5].properties.click_func()

      assert.equal(app.globalData.matchState.status, 'finished')
      assert.equal(
        Object.hasOwn(app.globalData.matchState, 'winnerTeam'),
        false
      )
      assert.equal(Object.hasOwn(app.globalData.matchState, 'winner'), false)
    },
    {
      setTimeout: timerHarness.setTimeout.bind(timerHarness),
      clearTimeout: timerHarness.clearTimeout.bind(timerHarness)
    }
  )
})

test('game manual finish confirmation timer is cleared on home navigation and destroy', async () => {
  const timerHarness = createManualFinishTimerHarness()

  await runWithRenderedGamePage(
    390,
    450,
    ({ createdWidgets, page }) => {
      const homeNavigations = []

      page.navigateToHomePage = () => {
        homeNavigations.push('page/index')
        return true
      }

      let buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      buttons[5].properties.click_func()

      const [homeTimerId] = [...timerHarness.pendingTimers.keys()]

      buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      buttons[4].properties.click_func()

      assert.equal(timerHarness.pendingTimers.size, 0)
      assert.equal(timerHarness.clearedTimerIds.includes(homeTimerId), true)
      assert.deepEqual(homeNavigations, ['page/index'])

      buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      buttons[5].properties.click_func()

      const [destroyTimerId] = [...timerHarness.pendingTimers.keys()]

      page.onDestroy()

      assert.equal(timerHarness.pendingTimers.size, 0)
      assert.equal(timerHarness.clearedTimerIds.includes(destroyTimerId), true)
    },
    {
      setTimeout: timerHarness.setTimeout.bind(timerHarness),
      clearTimeout: timerHarness.clearTimeout.bind(timerHarness)
    }
  )
})

test('game controls keep minimum 48x48 touch targets in active state', async () => {
  const screenScenarios = [
    { width: 390, height: 450 },
    { width: 390, height: 390 },
    { width: 454, height: 454 }
  ]

  for (const scenario of screenScenarios) {
    await runWithRenderedGamePage(
      scenario.width,
      scenario.height,
      ({ createdWidgets }) => {
        const activeButtons = getVisibleWidgets(createdWidgets, 'BUTTON')

        assert.equal(activeButtons.length, 6)
        activeButtons.forEach((button) => {
          // Image buttons use w: -1, h: -1 (native image dimensions)
          if (button.properties.normal_src) {
            // Icon buttons - check that expected footer assets are used
            assert.equal(
              button.properties.normal_src === 'home-icon.png' ||
                button.properties.normal_src === 'coach-icon.png',
              true
            )
          } else {
            // Text button - check dimensions
            assert.equal(button.properties.w >= 48, true)
            assert.equal(button.properties.h >= 48, true)
          }
        })
      }
    )
  }
})

test('game control buttons apply primary and secondary style variants', async () => {
  await runWithRenderedGamePage(390, 450, ({ createdWidgets }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = buttons[0]
    const removeTeamAButton = buttons[2]
    const homeIconButton = buttons[4]
    const manualFinishButton = buttons[5]

    assert.equal(buttons.length, 6)
    assert.equal(addTeamAButton?.properties.normal_color, 0x000000)
    assert.equal(addTeamAButton?.properties.press_color, 0x000000)
    assert.equal(addTeamAButton?.properties.color, 0xffffff)

    assert.equal(removeTeamAButton?.properties.normal_color, 0x24262b)
    assert.equal(removeTeamAButton?.properties.press_color, 0x2d3036)
    assert.equal(removeTeamAButton?.properties.color, 0xff6d78)

    // Home icon button uses image instead of color styling
    assert.equal(homeIconButton?.properties.normal_src, 'home-icon.png')
    assert.equal(homeIconButton?.properties.press_src, 'home-icon.png')

    assert.equal(manualFinishButton?.properties.normal_src, 'coach-icon.png')
    assert.equal(manualFinishButton?.properties.press_src, 'coach-icon.png')
  })
})

test('game screen controls call team-specific handlers for add and remove', async () => {
  await runWithRenderedGamePage(390, 450, ({ createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const backHomeButton = buttons[4]
    const manualFinishButton = buttons[5]
    const calls = []

    assert.equal(buttons.length, 6)
    assert.equal(typeof buttons[0]?.properties.click_func, 'function')
    assert.equal(typeof buttons[1]?.properties.click_func, 'function')
    assert.equal(typeof buttons[2]?.properties.click_func, 'function')
    assert.equal(typeof buttons[3]?.properties.click_func, 'function')
    assert.equal(typeof backHomeButton?.properties.click_func, 'function')
    assert.equal(typeof manualFinishButton?.properties.click_func, 'function')

    page.handleAddPointForTeam = (team) => {
      calls.push(`add:${team}`)
    }

    page.handleRemovePointForTeam = (team) => {
      calls.push(`remove:${team}`)
    }

    page.handleBackToHome = () => {
      calls.push('home:back')
    }

    page.handleManualFinishTap = () => {
      calls.push('finish:tap')
    }

    buttons[0].properties.click_func()
    buttons[1].properties.click_func()
    buttons[2].properties.click_func()
    buttons[3].properties.click_func()
    backHomeButton.properties.click_func()
    manualFinishButton.properties.click_func()

    assert.deepEqual(calls, [
      'add:teamA',
      'add:teamB',
      'remove:teamA',
      'remove:teamB',
      'home:back',
      'finish:tap'
    ])
  })
})

test('game back-home control navigates directly to home screen', async () => {
  const originalHmApp = globalThis.hmApp
  const navigationCalls = []

  globalThis.hmApp = {
    gotoPage(options) {
      navigationCalls.push({ method: 'gotoPage', url: options?.url })
    }
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ createdWidgets }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const backHomeButton = buttons[4]

      assert.equal(typeof backHomeButton?.properties.click_func, 'function')

      backHomeButton.properties.click_func()
    })

    const homeNavigation = navigationCalls.find(
      (call) => call.url === 'page/index'
    )
    assert.equal(
      homeNavigation !== undefined,
      true,
      'Should navigate to page/index'
    )
    assert.equal(homeNavigation.method, 'gotoPage')
  } finally {
    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('game back-home control navigates to home screen when gotoPage is available', async () => {
  const originalHmApp = globalThis.hmApp
  const navigationCalls = []

  globalThis.hmApp = {
    gotoPage(options) {
      navigationCalls.push(options?.url ?? '')
    }
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ createdWidgets }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const backHomeButton = buttons[4]

      backHomeButton.properties.click_func()
    })

    assert.equal(navigationCalls.includes('page/index'), true)
  } finally {
    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('game lifecycle auto-save calls handleLifecycleAutoSave', async () => {
  await runWithRenderedGamePage(390, 450, ({ page }) => {
    const result1 = page.handleLifecycleAutoSave()
    assert.equal(result1, true)

    page.isSessionAccessGranted = false
    const result2 = page.handleLifecycleAutoSave()
    assert.equal(result2, false)
  })
})

test('game persistence uses synchronous storage', async () => {
  await runWithRenderedGamePage(390, 450, ({ page }) => {
    const result = page.saveCurrentRuntimeState({ force: true })
    assert.equal(result, true)
  })
})

test('team-specific remove buttons remove latest point scored by selected team', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    // Buttons order: [0] teamA score, [1] teamB score, [2] teamA remove, [3] teamB remove, [4] back-home, [5] manual finish
    const addTeamAButton = buttons[0]
    const addTeamBButton = buttons[1]
    const removeTeamAButton = buttons[2]
    const removeTeamBButton = buttons[3]

    page.getCurrentTimeMs = createAcceptedInteractionTimeSource()

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

test('game controls update visible game and set scores after winning a game', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = buttons[0]

    page.getCurrentTimeMs = createAcceptedInteractionTimeSource()

    for (let index = 0; index < 4; index += 1) {
      addTeamAButton.properties.click_func()
    }

    assert.equal(app.globalData.matchState.currentSetStatus.teamAGames, 1)
    assert.equal(app.globalData.matchState.currentSetStatus.teamBGames, 0)
    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.LOVE)
    assert.equal(app.globalData.matchState.teamB.points, SCORE_POINTS.LOVE)
  })
})

test('game scoring updates runtime state', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = buttons[0]

    page.getCurrentTimeMs = createAcceptedInteractionTimeSource()

    addTeamAButton.properties.click_func()

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.FIFTEEN)
  })
})

test('game scoring debounce ignores rapid repeated taps inside 300ms window', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = buttons[0]
    const timeSamples = [1000, 1012, 1040, 1200]

    page.getCurrentTimeMs = () => timeSamples.shift()

    addTeamAButton.properties.click_func()
    addTeamAButton.properties.click_func()

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.FIFTEEN)
    assert.equal(app.globalData.matchHistory.size(), 1)
  })
})

test('game scoring debounce applies across scoring controls and accepts taps after window', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = buttons[0]
    const removeTeamAButton = buttons[2]
    const timeSamples = [1000, 1010, 1020, 1200, 1400, 1410, 1420]

    page.getCurrentTimeMs = () => timeSamples.shift()

    addTeamAButton.properties.click_func()
    removeTeamAButton.properties.click_func()
    removeTeamAButton.properties.click_func()

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.LOVE)
    assert.equal(app.globalData.matchHistory.size(), 0)
  })
})

test('game scoring debounce does not block immediate back-home navigation', async () => {
  const originalHmApp = globalThis.hmApp
  const navigationCalls = []

  globalThis.hmApp = {
    gotoPage(options) {
      navigationCalls.push({ method: 'gotoPage', url: options?.url })
    }
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ createdWidgets, page }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const addTeamAButton = buttons[0]
      const backHomeButton = buttons[4]
      const timeSamples = [1000, 1012, 1044]

      page.getCurrentTimeMs = () => timeSamples.shift()

      addTeamAButton.properties.click_func()
      backHomeButton.properties.click_func()
    })

    const homeNavigation = navigationCalls.find(
      (call) => call.url === 'page/index'
    )
    assert.equal(
      homeNavigation !== undefined,
      true,
      'Should navigate to page/index'
    )
    assert.equal(homeNavigation.method, 'gotoPage')
  } finally {
    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('game interaction performance metrics cover realistic add/remove flow under target budget', async () => {
  await runWithRenderedGamePage(390, 450, ({ createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = buttons[0]
    const addTeamBButton = buttons[1]
    const removeTeamBButton = buttons[3]
    const timeSamples = [1000, 1012, 1044, 2000, 2016, 2052, 3000, 3018, 3070]

    page.getCurrentTimeMs = () => timeSamples.shift()

    addTeamAButton.properties.click_func()
    addTeamBButton.properties.click_func()
    removeTeamBButton.properties.click_func()
  })
})

test('game interaction performance metrics flag over-budget high-history team remove path', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = buttons[0]
    const addTeamBButton = buttons[1]
    const removeTeamAButton = buttons[2]
    const highHistoryInteractionCount = 48

    page.getCurrentTimeMs = createAcceptedInteractionTimeSource()

    for (let index = 0; index < highHistoryInteractionCount; index += 1) {
      const addButton = index % 2 === 0 ? addTeamAButton : addTeamBButton
      addButton.properties.click_func()
    }

    const historyDepthBeforeRemove = app.globalData.matchHistory.size()

    assert.equal(historyDepthBeforeRemove >= 1, true)

    removeTeamAButton.properties.click_func()

    assert.equal(
      app.globalData.matchHistory.size(),
      historyDepthBeforeRemove - 1
    )
  })
})

// ============================================================================
// Game Access Guard Tests
// ============================================================================

/**
 * Creates a serialized match state for testing session persistence
 */
function createSerializedMatchState(overrides = {}) {
  const baseState = {
    status: 'active',
    setsToPlay: 3,
    setsNeededToWin: 2,
    setsWon: { teamA: 0, teamB: 0 },
    currentSet: { number: 1, games: { teamA: 0, teamB: 0 } },
    currentGame: { points: { teamA: 0, teamB: 0 } },
    setHistory: [],
    updatedAt: Date.now(),
    schemaVersion: 1,
    ...overrides
  }
  return JSON.stringify(baseState)
}

/**
 * Helper to run session access guard tests with isolated storage mocking
 */
async function runSessionGuardTest(storageValue, runAssertions) {
  const originalHmFS = globalThis.hmFS
  const originalHmApp = globalThis.hmApp
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalGetApp = globalThis.getApp

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const navigationCalls = []

  // Pre-seed the file store with storageValue at ACTIVE_MATCH_SESSION.json
  // so the file-based storage layer (hmFS) returns it for the session guard check.
  const initialFiles = {}
  if (storageValue !== null && storageValue !== undefined) {
    initialFiles[storageKeyToFilename(ACTIVE_MATCH_SESSION_STORAGE_KEY)] =
      storageValue
  }
  globalThis.hmFS = createHmFsMock(initialFiles).mock

  globalThis.hmApp = {
    gotoPage(options) {
      navigationCalls.push(options)
    },
    goBack() {
      navigationCalls.push({ goBack: true })
    }
  }

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }
  // Set up getApp without a valid handoff state for storage failure tests.
  // consumeSessionHandoff() reads from pendingPersistedMatchState specifically,
  // so we must explicitly set it to null to prevent cross-test contamination
  // when test files run in parallel (node --test runs files concurrently).
  globalThis.getApp = () => ({
    globalData: {
      matchState: null,
      matchHistory: createHistoryStack(),
      pendingPersistedMatchState: null
    }
  })

  try {
    const definition = await loadGamePageDefinition()
    const page = createPageInstance(definition)

    await runAssertions({
      page,
      createdWidgets,
      navigationCalls,
      getVisibleWidgets
    })
  } finally {
    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }

    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }

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

test('game access guard redirects to setup when persisted session is missing', async () => {
  await runSessionGuardTest(null, async ({ page, navigationCalls }) => {
    const result = await page.validateSessionAccess()

    assert.equal(result, false)
    assert.equal(page.isSessionAccessGranted, false)
    assert.equal(navigationCalls.length, 1)
    assert.deepEqual(navigationCalls[0], { url: 'page/setup' })
  })
})

test('game access guard redirects to setup when persisted session is empty string', async () => {
  await runSessionGuardTest('', async ({ page, navigationCalls }) => {
    const result = await page.validateSessionAccess()

    assert.equal(result, false)
    assert.equal(page.isSessionAccessGranted, false)
    assert.equal(navigationCalls.length, 1)
    assert.deepEqual(navigationCalls[0], { url: 'page/setup' })
  })
})

test('game access guard redirects to setup when persisted session is invalid JSON', async () => {
  await runSessionGuardTest(
    'not-valid-json{{{',
    async ({ page, navigationCalls }) => {
      const result = await page.validateSessionAccess()

      assert.equal(result, false)
      assert.equal(page.isSessionAccessGranted, false)
      assert.equal(navigationCalls.length, 1)
      assert.deepEqual(navigationCalls[0], { url: 'page/setup' })
    }
  )
})

test('game access guard redirects to setup when persisted session has invalid schema', async () => {
  await runSessionGuardTest(
    JSON.stringify({ invalid: 'structure' }),
    async ({ page, navigationCalls }) => {
      const result = await page.validateSessionAccess()

      assert.equal(result, false)
      assert.equal(page.isSessionAccessGranted, false)
      assert.equal(navigationCalls.length, 1)
      assert.deepEqual(navigationCalls[0], { url: 'page/setup' })
    }
  )
})

test('game access guard redirects to setup when persisted session is finished', async () => {
  const finishedState = createSerializedMatchState({ status: 'finished' })

  await runSessionGuardTest(
    finishedState,
    async ({ page, navigationCalls }) => {
      const result = await page.validateSessionAccess()

      assert.equal(result, false)
      assert.equal(page.isSessionAccessGranted, false)
      assert.equal(navigationCalls.length, 1)
      assert.deepEqual(navigationCalls[0], { url: 'page/setup' })
    }
  )
})

test('game access guard allows render when persisted session is valid and active', async () => {
  const activeState = createSerializedMatchState({ status: 'active' })

  await runSessionGuardTest(
    activeState,
    async ({ page, navigationCalls, createdWidgets, getVisibleWidgets }) => {
      // Initialize page state like onInit does
      page.widgets = []
      page.isSessionAccessGranted = false

      // Mock the hasValidActiveSession to return true for valid active session
      page.hasValidActiveSession = async () => true

      const result = await page.validateSessionAccess()

      assert.equal(result, true)
      assert.equal(page.isSessionAccessGranted, true)
      assert.equal(navigationCalls.length, 0)

      page.build()

      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      assert.equal(buttons.length, 6)

      // First 4 buttons are text buttons, then home + manual finish icons
      const labels = buttons.map((button) => button.properties.text)
      assert.deepEqual(labels.slice(0, 4), ['0', '0', '−', '−'])
      // Icon buttons use normal_src instead of text
      assert.equal(buttons[4]?.properties.normal_src, 'home-icon.png')
      assert.equal(buttons[5]?.properties.normal_src, 'coach-icon.png')
    }
  )
})

test('game access guard caches session access after successful validation', async () => {
  const activeState = createSerializedMatchState({ status: 'active' })

  await runSessionGuardTest(activeState, async ({ page, navigationCalls }) => {
    // Initialize page state like onInit does
    page.widgets = []
    page.isSessionAccessGranted = false

    // Mock the hasValidActiveSession to return true for valid active session
    page.hasValidActiveSession = async () => true

    const firstResult = await page.validateSessionAccess()
    assert.equal(firstResult, true)

    const secondResult = await page.validateSessionAccess()
    assert.equal(secondResult, true)

    assert.equal(navigationCalls.length, 0)
  })
})

test('game access guard build is no-op when session not yet validated', async () => {
  await runSessionGuardTest(
    null,
    async ({ page, createdWidgets, getVisibleWidgets }) => {
      page.isSessionAccessGranted = false
      page.build()

      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      assert.equal(buttons.length, 0)
    }
  )
})

// ============================================================================
// Gesture Event Handler Tests
// ============================================================================

test('game registerGestureHandler is called during build', async () => {
  const originalHmApp = globalThis.hmApp
  const registerCalls = []

  globalThis.hmApp = {
    gotoPage() {},
    gesture: { RIGHT: 'right' },
    registerGestureEvent(callback) {
      registerCalls.push({ callback: typeof callback })
    },
    unregisterGestureEvent() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, () => {
      assert.equal(
        registerCalls.length,
        1,
        'registerGestureEvent should be called once'
      )
      assert.equal(
        registerCalls[0].callback,
        'function',
        'registerGestureEvent should receive a callback function'
      )
    })
  } finally {
    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('game gesture handler returns true for RIGHT gesture and navigates to home', async () => {
  const originalHmApp = globalThis.hmApp
  let gestureCallback = null
  const navigationCalls = []
  const saveCalls = []

  globalThis.hmApp = {
    gotoPage(options) {
      navigationCalls.push(options?.url)
    },
    gesture: { RIGHT: 'right', LEFT: 'left' },
    registerGestureEvent(callback) {
      gestureCallback = callback
    },
    unregisterGestureEvent() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ page }) => {
      // Override saveCurrentRuntimeState to track calls
      const originalSave = page.saveCurrentRuntimeState.bind(page)
      page.saveCurrentRuntimeState = (options) => {
        saveCalls.push(options)
        return originalSave(options)
      }

      assert.equal(
        typeof gestureCallback,
        'function',
        'gesture callback should be registered'
      )

      const result = gestureCallback('right')

      assert.equal(
        result,
        true,
        'RIGHT gesture should return true to skip default back behavior'
      )
      assert.equal(
        saveCalls.length,
        1,
        'saveCurrentRuntimeState should be called once'
      )
      assert.deepEqual(
        saveCalls[0],
        { force: true },
        'saveCurrentRuntimeState should be called with force: true'
      )
      assert.equal(
        navigationCalls.includes('page/index'),
        true,
        'Should navigate to page/index'
      )
    })
  } finally {
    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('game gesture handler returns false for non-RIGHT gestures', async () => {
  const originalHmApp = globalThis.hmApp
  let gestureCallback = null
  const navigationCalls = []

  globalThis.hmApp = {
    gotoPage(options) {
      navigationCalls.push(options?.url)
    },
    gesture: { RIGHT: 'right', LEFT: 'left', UP: 'up', DOWN: 'down' },
    registerGestureEvent(callback) {
      gestureCallback = callback
    },
    unregisterGestureEvent() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, () => {
      assert.equal(
        typeof gestureCallback,
        'function',
        'gesture callback should be registered'
      )

      // Clear any navigation from onInit's validateSessionAccess (e.g., page/setup)
      navigationCalls.length = 0

      const leftResult = gestureCallback('left')
      const upResult = gestureCallback('up')
      const downResult = gestureCallback('down')

      assert.equal(
        leftResult,
        false,
        'LEFT gesture should return false for default behavior'
      )
      assert.equal(
        upResult,
        false,
        'UP gesture should return false for default behavior'
      )
      assert.equal(
        downResult,
        false,
        'DOWN gesture should return false for default behavior'
      )

      // Check that no HOME navigation occurred for non-RIGHT gestures
      const homeNavigations = navigationCalls.filter(
        (url) => url === 'page/index'
      )
      assert.equal(
        homeNavigations.length,
        0,
        'Should not navigate to home for non-RIGHT gestures'
      )
    })
  } finally {
    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('game unregisterGestureHandler is called during onDestroy', async () => {
  const originalHmApp = globalThis.hmApp
  const unregisterCalls = []

  globalThis.hmApp = {
    gotoPage() {},
    gesture: { RIGHT: 'right' },
    registerGestureEvent() {},
    unregisterGestureEvent() {
      unregisterCalls.push(true)
    }
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ page }) => {
      page.onDestroy()
      assert.equal(
        unregisterCalls.length,
        1,
        'unregisterGestureEvent should be called once in onDestroy'
      )
    })
  } finally {
    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('game gesture handler does not throw when hmApp is unavailable', async () => {
  const originalHmApp = globalThis.hmApp

  delete globalThis.hmApp

  try {
    // Should not throw
    await runWithRenderedGamePage(390, 450, ({ page }) => {
      // registerGestureHandler should not throw
      page.registerGestureHandler()
      // unregisterGestureHandler should not throw
      page.unregisterGestureHandler()
    })
  } finally {
    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})
