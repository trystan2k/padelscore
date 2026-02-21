import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createScoreViewModel } from '../page/score-view-model.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { matchStorage, ZeppOsStorageAdapter } from '../utils/match-storage.js'
import { STORAGE_KEY as ACTIVE_MATCH_SESSION_STORAGE_KEY } from '../utils/match-state-schema.js'
import { createHistoryStack } from '../utils/history-stack.js'
import { SCORE_POINTS } from '../utils/scoring-constants.js'
import { MATCH_STATE_STORAGE_KEY } from '../utils/storage.js'

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
  const scoringConstantsUrl = new URL('../utils/scoring-constants.js', import.meta.url)
  const scoringEngineUrl = new URL('../utils/scoring-engine.js', import.meta.url)
  const storageUrl = new URL('../utils/storage.js', import.meta.url)
  const matchStorageUrl = new URL('../utils/match-storage.js', import.meta.url)
  const matchStateSchemaUrl = new URL('../utils/match-state-schema.js', import.meta.url)

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace("import { gettext } from 'i18n'\n", 'const gettext = (key) => key\n')
    .replace("from './score-view-model.js'", `from '${scoreViewModelUrl.href}'`)
    .replace("from '../utils/history-stack.js'", `from '${historyStackUrl.href}'`)
    .replace("from '../utils/match-state.js'", `from '${matchStateUrl.href}'`)
    .replace("from '../utils/scoring-constants.js'", `from '${scoringConstantsUrl.href}'`)
    .replace("from '../utils/scoring-engine.js'", `from '${scoringEngineUrl.href}'`)
    .replace("from '../utils/storage.js'", `from '${storageUrl.href}'`)
    .replace("from '../utils/match-storage.js'", `from '${matchStorageUrl.href}'`)
    .replace("from '../utils/match-state-schema.js'", `from '${matchStateSchemaUrl.href}'`)

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
  const originalMatchStorageAdapter = matchStorage.adapter

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
  matchStorage.adapter = new ZeppOsStorageAdapter()

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

    matchStorage.adapter = originalMatchStorageAdapter
  }
}

function findButtonByText(buttons, text) {
  return buttons.find((button) => button.properties.text === text)
}

function findTextByExactContent(textWidgets, text) {
  return textWidgets.find((widget) => widget.properties.text === text)
}

function isNumericText(value) {
  return typeof value === 'string' && /^[0-9]+$/.test(value)
}

function parseSetsWonCounterValue(textValue) {
  if (typeof textValue !== 'string') {
    return null
  }

  const parsedMatch = /^game\.setsWonLabel:\s*([0-9]+)$/.exec(textValue)

  return parsedMatch ? parsedMatch[1] : null
}

function getPersistenceWritesByKey(writes, storageKey) {
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

function getRenderedScoreTextValues(createdWidgets) {
  const textWidgets = getVisibleWidgets(createdWidgets, 'TEXT').filter(hasVisibleRect)
  const setScoreCandidates = textWidgets.filter((widget) => isNumericText(widget.properties.text))
  const maxSetScoreRowY = Math.max(...setScoreCandidates.map((widget) => widget.properties.y))
  const setScoreWidgets = setScoreCandidates
    .filter((widget) => widget.properties.y === maxSetScoreRowY)
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

function getRenderedSetsWonTextValues(createdWidgets) {
  const textWidgets = getVisibleWidgets(createdWidgets, 'TEXT').filter(hasVisibleRect)
  const setCounterWidgets = textWidgets
    .filter((widget) => parseSetsWonCounterValue(widget.properties.text) !== null)
    .sort((left, right) => left.properties.x - right.properties.x)

  assert.equal(setCounterWidgets.length >= 2, true)

  return {
    teamASetsWon: parseSetsWonCounterValue(setCounterWidgets[0].properties.text),
    teamBSetsWon: parseSetsWonCounterValue(setCounterWidgets[1].properties.text)
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
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
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

    const renderedScores = getRenderedScoreTextValues(createdWidgets)

    assert.equal(renderedScores.gamePoints, 'Ad - Game')
  })
})

test('game runtime state keeps tie-break persisted points as numeric values', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
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

    const renderedScores = getRenderedScoreTextValues(createdWidgets)

    assert.equal(renderedScores.gamePoints, '50 - 60')
  })
})

test('game screen renders resumed manager team labels and score context', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
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

    assertRenderedScoresMatchState(createdWidgets, app.globalData.matchState)

    const textWidgets = getVisibleWidgets(createdWidgets, 'TEXT')

    assert.equal(Boolean(findTextByExactContent(textWidgets, 'Alpha')), true)
    assert.equal(Boolean(findTextByExactContent(textWidgets, 'Beta')), true)
  })
})

test('game match completion persists set metadata and attempts summary navigation', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  const originalHmApp = globalThis.hmApp
  const eventOrder = []
  const persistenceWrites = []
  const navigationCalls = []

  globalThis.settingsStorage = {
    setItem(key, value) {
      eventOrder.push(`save:${key}`)
      persistenceWrites.push({ key, value })
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  globalThis.hmApp = {
    gotoPage(options) {
      eventOrder.push(`navigate:${options?.url ?? ''}`)
      navigationCalls.push(options)
    }
  }

  try {
    await runWithRenderedGamePage(390, 450, async ({ app, createdWidgets, page }) => {
      page.persistenceDebounceWindowMs = 0
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
      const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')

      assert.equal(typeof addTeamAButton?.properties.click_func, 'function')

      addTeamAButton.properties.click_func()

      await page.waitForPersistenceIdle()

      assert.equal(app.globalData.matchState.status, 'finished')
      assert.equal(app.globalData.matchState.winnerTeam, 'teamA')
      assert.deepEqual(app.globalData.matchState.setsWon, {
        teamA: 1,
        teamB: 0
      })
      assert.deepEqual(app.globalData.matchState.setHistory, [
        {
          setNumber: 1,
          teamAGames: 6,
          teamBGames: 0
        }
      ])

      const visibleButtons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const textWidgets = getVisibleWidgets(createdWidgets, 'TEXT')
      const winnerText = textWidgets.find(
        (widget) =>
          typeof widget.properties.text === 'string' &&
          widget.properties.text.includes('Team A') &&
          widget.properties.text.includes('game.winsSuffix')
      )

      assert.equal(visibleButtons.length, 1)
      assert.equal(Boolean(findButtonByText(visibleButtons, 'game.teamAAddPoint')), false)
      assert.equal(Boolean(findButtonByText(visibleButtons, 'game.teamBAddPoint')), false)
      assert.equal(Boolean(findButtonByText(visibleButtons, 'game.teamARemovePoint')), false)
      assert.equal(Boolean(findButtonByText(visibleButtons, 'game.teamBRemovePoint')), false)
      assert.equal(Boolean(winnerText), true)
      assert.equal(navigationCalls.some((call) => call?.url === 'page/summary'), true)

      const activeSessionWrites = getPersistenceWritesByKey(
        persistenceWrites,
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      )
      const persistedFinishedSession = JSON.parse(
        activeSessionWrites[activeSessionWrites.length - 1]
      )

      assert.equal(persistedFinishedSession.status, 'finished')
      assert.deepEqual(persistedFinishedSession.setsWon, {
        teamA: 1,
        teamB: 0
      })
      assert.deepEqual(persistedFinishedSession.setHistory, [
        {
          setNumber: 1,
          teamAGames: 6,
          teamBGames: 0
        }
      ])
      assert.equal(persistedFinishedSession.winnerTeam, 'teamA')

      const persistedSessionSaveIndex = eventOrder.lastIndexOf(
        `save:${ACTIVE_MATCH_SESSION_STORAGE_KEY}`
      )
      const summaryNavigationIndex = eventOrder.indexOf('navigate:page/summary')

      assert.equal(persistedSessionSaveIndex >= 0, true)
      assert.equal(summaryNavigationIndex > persistedSessionSaveIndex, true)
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

test('game summary navigation resets after undo from finished match state', async () => {
  const originalHmApp = globalThis.hmApp
  const navigationCalls = []

  globalThis.hmApp = {
    gotoPage(options) {
      navigationCalls.push(options)
    }
  }

  try {
    await runWithRenderedGamePage(390, 450, async ({ app, createdWidgets, page }) => {
      page.persistenceDebounceWindowMs = 0
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
      const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')

      assert.equal(typeof addTeamAButton?.properties.click_func, 'function')

      addTeamAButton.properties.click_func()
      await page.waitForPersistenceIdle()

      assert.equal(app.globalData.matchState.status, 'finished')
      assert.equal(page.hasAttemptedSummaryNavigation, true)
      assert.equal(navigationCalls.filter((call) => call?.url === 'page/summary').length, 1)

      page.handleRemovePointForTeam('teamA')
      await page.waitForPersistenceIdle()

      assert.equal(app.globalData.matchState.status, 'active')
      assert.equal(page.hasAttemptedSummaryNavigation, false)
      assert.equal(navigationCalls.filter((call) => call?.url === 'page/summary').length, 1)

      page.handleAddPointForTeam('teamA')
      await page.waitForPersistenceIdle()

      assert.equal(app.globalData.matchState.status, 'finished')
      assert.equal(page.hasAttemptedSummaryNavigation, true)
      assert.equal(navigationCalls.filter((call) => call?.url === 'page/summary').length, 2)
    })
  } finally {
    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('game controls keep minimum 48x48 touch targets in active and finished states', async () => {
  const screenScenarios = [
    { width: 390, height: 450 },
    { width: 390, height: 390 },
    { width: 454, height: 454 }
  ]

  for (const scenario of screenScenarios) {
    await runWithRenderedGamePage(scenario.width, scenario.height, ({ app, createdWidgets, page }) => {
      const activeButtons = getVisibleWidgets(createdWidgets, 'BUTTON')

      assert.equal(activeButtons.length, 5)
      activeButtons.forEach((button) => {
        assert.equal(button.properties.w >= 48, true)
        assert.equal(button.properties.h >= 48, true)
      })

      app.globalData.matchState.status = 'finished'
      app.globalData.matchState.currentSetStatus.teamAGames = 0
      app.globalData.matchState.currentSetStatus.teamBGames = 6

      page.renderGameScreen()

      const finishedButtons = getVisibleWidgets(createdWidgets, 'BUTTON')

      assert.equal(finishedButtons.length, 1)
      assert.equal(finishedButtons[0].properties.w >= 48, true)
      assert.equal(finishedButtons[0].properties.h >= 48, true)
    })
  }
})

test('game control buttons apply primary and secondary style variants', async () => {
  await runWithRenderedGamePage(390, 450, ({ createdWidgets }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')
    const removeTeamAButton = findButtonByText(buttons, 'game.teamARemovePoint')
    const backHomeButton = findButtonByText(buttons, 'game.backHome')

    assert.equal(addTeamAButton?.properties.normal_color, 0x1eb98c)
    assert.equal(addTeamAButton?.properties.press_color, 0x1aa07a)
    assert.equal(addTeamAButton?.properties.color, 0x000000)

    assert.equal(removeTeamAButton?.properties.normal_color, 0x24262b)
    assert.equal(removeTeamAButton?.properties.press_color, 0x2d3036)
    assert.equal(removeTeamAButton?.properties.color, 0xff6d78)

    assert.equal(backHomeButton?.properties.normal_color, 0x24262b)
    assert.equal(backHomeButton?.properties.press_color, 0x2d3036)
    assert.equal(backHomeButton?.properties.color, 0xffffff)
  })
})

test('game finished state renders winner message and home-only navigation control', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    app.globalData.matchState.status = 'finished'
    app.globalData.matchState.currentSetStatus.teamAGames = 0
    app.globalData.matchState.currentSetStatus.teamBGames = 6
    app.globalData.matchState.teamA.games = 0
    app.globalData.matchState.teamB.games = 6

    page.renderGameScreen()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const textWidgets = getVisibleWidgets(createdWidgets, 'TEXT')
    const finishedLabel = findTextByExactContent(textWidgets, 'game.finishedLabel')
    const winnerText = textWidgets.find(
      (widget) =>
        typeof widget.properties.text === 'string' &&
        widget.properties.text.includes('Team B') &&
        widget.properties.text.includes('game.winsSuffix')
    )

    assert.equal(buttons.length, 1)
    assert.equal(buttons[0].properties.text, 'game.home')
    assert.equal(Boolean(findButtonByText(buttons, 'game.teamAAddPoint')), false)
    assert.equal(Boolean(findButtonByText(buttons, 'game.teamBAddPoint')), false)
    assert.equal(Boolean(findButtonByText(buttons, 'game.teamARemovePoint')), false)
    assert.equal(Boolean(findButtonByText(buttons, 'game.teamBRemovePoint')), false)
    assert.equal(Boolean(finishedLabel), true)
    assert.equal(Boolean(winnerText), true)
    assert.equal(winnerText?.properties.color, 0x1eb98c)
  })
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
  const persistenceWrites = []

  globalThis.settingsStorage = {
    setItem(key, value) {
      callOrder.push(`save:${key}`)
      persistenceWrites.push({ key, value })
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

      const legacyWrites = getPersistenceWritesByKey(
        persistenceWrites,
        MATCH_STATE_STORAGE_KEY
      )
      const activeSessionWrites = getPersistenceWritesByKey(
        persistenceWrites,
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      )

      assert.equal(legacyWrites.length, 1)
      assert.equal(activeSessionWrites.length, 1)
      assert.deepEqual(JSON.parse(legacyWrites[0]), app.globalData.matchState)
      assert.equal(callOrder[0], `save:${MATCH_STATE_STORAGE_KEY}`)
      assert.equal(callOrder.includes('goBack'), true)
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
  const persistenceWrites = []

  globalThis.settingsStorage = {
    setItem(key, value) {
      callOrder.push(`save:${key}`)
      persistenceWrites.push({ key, value })
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

      const legacyWrites = getPersistenceWritesByKey(
        persistenceWrites,
        MATCH_STATE_STORAGE_KEY
      )
      const activeSessionWrites = getPersistenceWritesByKey(
        persistenceWrites,
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      )

      assert.equal(legacyWrites.length, 1)
      assert.equal(activeSessionWrites.length, 1)
      assert.equal(callOrder[0], `save:${MATCH_STATE_STORAGE_KEY}`)
      assert.equal(callOrder.includes('goto:page/index'), true)
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
  const persistenceWrites = []

  globalThis.settingsStorage = {
    setItem(key, value) {
      persistenceWrites.push({ key, value })
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, async ({ app, page }) => {
      page.onHide()
      page.onDestroy()

      await page.waitForPersistenceIdle()

      const legacyWrites = getPersistenceWritesByKey(
        persistenceWrites,
        MATCH_STATE_STORAGE_KEY
      )
      const activeSessionWrites = getPersistenceWritesByKey(
        persistenceWrites,
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      )

      assert.equal(legacyWrites.length, 1)
      assert.equal(activeSessionWrites.length, 1)
      assert.deepEqual(JSON.parse(legacyWrites[0]), app.globalData.matchState)

      const persistedActiveSession = JSON.parse(activeSessionWrites[0])
      assert.equal(persistedActiveSession.status, 'active')
      assert.equal(persistedActiveSession.currentSet.number, app.globalData.matchState.currentSet)
    })
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }
})

test('game persistence debounce coalesces repeated save requests into one write cycle', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  const persistenceWrites = []

  globalThis.settingsStorage = {
    setItem(key, value) {
      persistenceWrites.push({ key, value })
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, async ({ page }) => {
      page.persistenceDebounceWindowMs = 0

      page.saveCurrentRuntimeState()
      page.saveCurrentRuntimeState()
      page.saveCurrentRuntimeState()

      await page.waitForPersistenceIdle()

      const legacyWrites = getPersistenceWritesByKey(
        persistenceWrites,
        MATCH_STATE_STORAGE_KEY
      )
      const activeSessionWrites = getPersistenceWritesByKey(
        persistenceWrites,
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      )

      assert.equal(legacyWrites.length, 1)
      assert.equal(activeSessionWrites.length, 1)
    })
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }
})

test('game persistence queue keeps latest state when force saves overlap', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  const persistenceWrites = []

  globalThis.settingsStorage = {
    setItem(key, value) {
      persistenceWrites.push({ key, value })
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, async ({ app, page }) => {
      let releaseFirstPersistenceRun = null
      let resolveFirstPersistenceStarted = null
      const firstPersistenceStarted = new Promise((resolve) => {
        resolveFirstPersistenceStarted = resolve
      })

      const originalPersistRuntimeStateSnapshot =
        page.persistRuntimeStateSnapshot.bind(page)
      let isFirstPersistenceRun = true

      page.persistRuntimeStateSnapshot = async (runtimeState, signature) => {
        if (isFirstPersistenceRun) {
          isFirstPersistenceRun = false

          await new Promise((resolve) => {
            releaseFirstPersistenceRun = resolve
            resolveFirstPersistenceStarted()
          })
        }

        return originalPersistRuntimeStateSnapshot(runtimeState, signature)
      }

      page.saveCurrentRuntimeState({ force: true })
      await firstPersistenceStarted

      app.globalData.matchState.teamA.points = SCORE_POINTS.FIFTEEN
      page.saveCurrentRuntimeState({ force: true })

      app.globalData.matchState.teamA.points = SCORE_POINTS.THIRTY
      page.saveCurrentRuntimeState({ force: true })

      releaseFirstPersistenceRun()
      await page.waitForPersistenceIdle()

      const legacyWrites = getPersistenceWritesByKey(
        persistenceWrites,
        MATCH_STATE_STORAGE_KEY
      ).map((payload) => JSON.parse(payload))

      assert.equal(legacyWrites.length, 2)
      assert.equal(legacyWrites[0].teamA.points, SCORE_POINTS.LOVE)
      assert.equal(legacyWrites[1].teamA.points, SCORE_POINTS.THIRTY)
      assert.deepEqual(legacyWrites[1], app.globalData.matchState)
    })
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }
})

test('game lifecycle flush persists latest scoring state before debounce delay elapses', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  const persistenceWrites = []

  globalThis.settingsStorage = {
    setItem(key, value) {
      persistenceWrites.push({ key, value })
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, async ({ app, createdWidgets, page }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')

      page.persistenceDebounceWindowMs = 500
      page.getCurrentTimeMs = createAcceptedInteractionTimeSource()

      addTeamAButton.properties.click_func()
      page.onHide()
      page.onDestroy()

      await page.waitForPersistenceIdle()

      const legacyWrites = getPersistenceWritesByKey(
        persistenceWrites,
        MATCH_STATE_STORAGE_KEY
      )
      const activeSessionWrites = getPersistenceWritesByKey(
        persistenceWrites,
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      )

      assert.equal(legacyWrites.length, 1)
      assert.equal(activeSessionWrites.length, 1)

      const persistedRuntimeState = JSON.parse(legacyWrites[0])
      assert.equal(persistedRuntimeState.teamA.points, SCORE_POINTS.FIFTEEN)
      assert.deepEqual(persistedRuntimeState, app.globalData.matchState)

      const persistedActiveSession = JSON.parse(activeSessionWrites[0])
      assert.equal(persistedActiveSession.currentGame.points.teamA, SCORE_POINTS.FIFTEEN)
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
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')
    const addTeamBButton = findButtonByText(buttons, 'game.teamBAddPoint')
    const removeTeamAButton = findButtonByText(buttons, 'game.teamARemovePoint')
    const removeTeamBButton = findButtonByText(buttons, 'game.teamBRemovePoint')

    page.getCurrentTimeMs = createAcceptedInteractionTimeSource()

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
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')

    page.getCurrentTimeMs = createAcceptedInteractionTimeSource()

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
  const persistenceWrites = []

  globalThis.settingsStorage = {
    setItem(key, value) {
      interactionEvents.push(`save:${key}`)
      persistenceWrites.push({ key, value })
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  try {
    await runWithRenderedGamePage(390, 450, async ({ app, createdWidgets, page }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')

      const originalUpdateRuntimeMatchState = page.updateRuntimeMatchState.bind(page)
      const originalRenderGameScreen = page.renderGameScreen.bind(page)

      page.persistenceDebounceWindowMs = 0

      page.updateRuntimeMatchState = (nextState) => {
        interactionEvents.push('update')
        return originalUpdateRuntimeMatchState(nextState)
      }

      page.renderGameScreen = () => {
        interactionEvents.push('render')
        return originalRenderGameScreen()
      }

      addTeamAButton.properties.click_func()

      await page.waitForPersistenceIdle()

      const legacyWrites = getPersistenceWritesByKey(
        persistenceWrites,
        MATCH_STATE_STORAGE_KEY
      )
      const activeSessionWrites = getPersistenceWritesByKey(
        persistenceWrites,
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      )

      assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.FIFTEEN)
      assert.equal(legacyWrites.length, 1)
      assert.equal(activeSessionWrites.length, 1)
      assert.deepEqual(JSON.parse(legacyWrites[0]), app.globalData.matchState)
      assert.equal(
        interactionEvents.indexOf('update') <
          interactionEvents.indexOf(`save:${MATCH_STATE_STORAGE_KEY}`),
        true
      )
      assert.equal(
        interactionEvents.indexOf('render') <
          interactionEvents.indexOf(`save:${MATCH_STATE_STORAGE_KEY}`),
        true
      )
    })
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }
})

test('game scoring debounce ignores rapid repeated taps inside 300ms window', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')
    const timeSamples = [1000, 1012, 1040, 1200]
    let updateCount = 0
    let renderCount = 0
    let saveCount = 0

    const originalUpdateRuntimeMatchState = page.updateRuntimeMatchState.bind(page)
    const originalRenderGameScreen = page.renderGameScreen.bind(page)
    const originalSaveCurrentRuntimeState = page.saveCurrentRuntimeState.bind(page)

    page.getCurrentTimeMs = () => timeSamples.shift()
    page.updateRuntimeMatchState = (nextState) => {
      updateCount += 1
      return originalUpdateRuntimeMatchState(nextState)
    }
    page.renderGameScreen = () => {
      renderCount += 1
      return originalRenderGameScreen()
    }
    page.saveCurrentRuntimeState = () => {
      saveCount += 1
      return originalSaveCurrentRuntimeState()
    }

    addTeamAButton.properties.click_func()
    addTeamAButton.properties.click_func()

    assert.equal(app.globalData.matchState.teamA.points, SCORE_POINTS.FIFTEEN)
    assert.equal(app.globalData.matchHistory.size(), 1)
    assert.equal(updateCount, 1)
    assert.equal(renderCount, 1)
    assert.equal(saveCount, 1)
  })
})

test('game scoring debounce applies across scoring controls and accepts taps after window', async () => {
  await runWithRenderedGamePage(390, 450, ({ app, createdWidgets, page }) => {
    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')
    const removeTeamAButton = findButtonByText(buttons, 'game.teamARemovePoint')
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
  const originalSettingsStorage = globalThis.settingsStorage
  const originalHmApp = globalThis.hmApp
  const interactionOrder = []

  globalThis.settingsStorage = {
    setItem() {
      interactionOrder.push('save')
    },
    getItem() {
      return null
    },
    removeItem() {}
  }

  globalThis.hmApp = {
    goBack() {
      interactionOrder.push('goBack')
    }
  }

  try {
    await runWithRenderedGamePage(390, 450, ({ createdWidgets, page }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const addTeamAButton = findButtonByText(buttons, 'game.teamAAddPoint')
      const backHomeButton = findButtonByText(buttons, 'game.backHome')
      const timeSamples = [1000, 1012, 1044]

      page.getCurrentTimeMs = () => timeSamples.shift()

      addTeamAButton.properties.click_func()
      backHomeButton.properties.click_func()

      assert.deepEqual(interactionOrder, ['save', 'save', 'goBack'])
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

    page.getCurrentTimeMs = createAcceptedInteractionTimeSource()

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
  const originalSettingsStorage = globalThis.settingsStorage
  const originalHmApp = globalThis.hmApp
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalGetApp = globalThis.getApp

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const navigationCalls = []

  globalThis.settingsStorage = {
    getItem(key) {
      // match-storage.js uses ACTIVE_MATCH_SESSION key
      if (key === 'ACTIVE_MATCH_SESSION') {
        return storageValue
      }
      return null
    },
    setItem() {},
    removeItem() {}
  }

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
  globalThis.getApp = () => ({
    globalData: {
      matchState: createInitialMatchState(1700000000),
      matchHistory: createHistoryStack()
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
  await runSessionGuardTest('not-valid-json{{{', async ({ page, navigationCalls }) => {
    const result = await page.validateSessionAccess()

    assert.equal(result, false)
    assert.equal(page.isSessionAccessGranted, false)
    assert.equal(navigationCalls.length, 1)
    assert.deepEqual(navigationCalls[0], { url: 'page/setup' })
  })
})

test('game access guard redirects to setup when persisted session has invalid schema', async () => {
  await runSessionGuardTest(JSON.stringify({ invalid: 'structure' }), async ({ page, navigationCalls }) => {
    const result = await page.validateSessionAccess()

    assert.equal(result, false)
    assert.equal(page.isSessionAccessGranted, false)
    assert.equal(navigationCalls.length, 1)
    assert.deepEqual(navigationCalls[0], { url: 'page/setup' })
  })
})

test('game access guard redirects to setup when persisted session is finished', async () => {
  const finishedState = createSerializedMatchState({ status: 'finished' })

  await runSessionGuardTest(finishedState, async ({ page, navigationCalls }) => {
    const result = await page.validateSessionAccess()

    assert.equal(result, false)
    assert.equal(page.isSessionAccessGranted, false)
    assert.equal(navigationCalls.length, 1)
    assert.deepEqual(navigationCalls[0], { url: 'page/setup' })
  })
})

test('game access guard allows render when persisted session is valid and active', async () => {
  const activeState = createSerializedMatchState({ status: 'active' })

  await runSessionGuardTest(activeState, async ({ page, navigationCalls, createdWidgets, getVisibleWidgets }) => {
    // Initialize page state like onInit does
    page.widgets = []
    page.isSessionAccessCheckInFlight = false
    page.isSessionAccessGranted = false

    // Mock the hasValidActiveSession to return true for valid active session
    page.hasValidActiveSession = async () => true

    const result = await page.validateSessionAccess()

    assert.equal(result, true)
    assert.equal(page.isSessionAccessGranted, true)
    assert.equal(navigationCalls.length, 0)

    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    assert.equal(buttons.length, 5)

    const labels = buttons.map((button) => button.properties.text)
    assert.deepEqual(labels, [
      'game.teamAAddPoint',
      'game.teamBAddPoint',
      'game.teamARemovePoint',
      'game.teamBRemovePoint',
      'game.backHome'
    ])
  })
})

test('game access guard caches session access after successful validation', async () => {
  const activeState = createSerializedMatchState({ status: 'active' })

  await runSessionGuardTest(activeState, async ({ page, navigationCalls }) => {
    // Initialize page state like onInit does
    page.widgets = []
    page.isSessionAccessCheckInFlight = false
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
  await runSessionGuardTest(null, async ({ page, createdWidgets, getVisibleWidgets }) => {
    page.isSessionAccessGranted = false
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    assert.equal(buttons.length, 0)
  })
})

test('game access guard does not re-check session when already in flight', async () => {
  await runSessionGuardTest(null, async ({ page }) => {
    page.isSessionAccessCheckInFlight = false
    const firstCheck = page.validateSessionAccess()

    assert.equal(page.isSessionAccessCheckInFlight, true)
    const secondCheck = page.validateSessionAccess()

    const secondResult = await secondCheck
    assert.equal(secondResult, false)

    const firstResult = await firstCheck
    assert.equal(firstResult, false)
  })
})
