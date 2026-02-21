import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { matchStorage } from '../utils/match-storage.js'
import { STORAGE_KEY as ACTIVE_MATCH_SESSION_STORAGE_KEY } from '../utils/match-state-schema.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { MATCH_STATE_STORAGE_KEY } from '../utils/storage.js'

let summaryPageImportCounter = 0

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

function createFinishedPersistedMatchState(overrides = {}) {
  const baseState = {
    status: 'finished',
    setsToPlay: 3,
    setsNeededToWin: 2,
    setsWon: {
      teamA: 2,
      teamB: 1
    },
    currentSet: {
      number: 3,
      games: {
        teamA: 0,
        teamB: 0
      }
    },
    currentGame: {
      points: {
        teamA: 0,
        teamB: 0
      }
    },
    winnerTeam: 'teamA',
    setHistory: [
      {
        setNumber: 1,
        teamAGames: 6,
        teamBGames: 4
      },
      {
        setNumber: 2,
        teamAGames: 4,
        teamBGames: 6
      },
      {
        setNumber: 3,
        teamAGames: 6,
        teamBGames: 2
      }
    ],
    updatedAt: Date.now(),
    schemaVersion: 1
  }

  return {
    ...baseState,
    ...overrides,
    setsWon: {
      ...baseState.setsWon,
      ...overrides.setsWon
    },
    currentSet: {
      ...baseState.currentSet,
      ...overrides.currentSet,
      games: {
        ...baseState.currentSet.games,
        ...overrides.currentSet?.games
      }
    },
    currentGame: {
      ...baseState.currentGame,
      ...overrides.currentGame,
      points: {
        ...baseState.currentGame.points,
        ...overrides.currentGame?.points
      }
    },
    setHistory: Array.isArray(overrides.setHistory)
      ? overrides.setHistory
      : baseState.setHistory
  }
}

function createFinishedRuntimeMatchState(overrides = {}) {
  const runtimeState = {
    ...createInitialMatchState(1700000000),
    status: 'finished',
    setsWon: {
      teamA: 1,
      teamB: 0
    },
    winnerTeam: 'teamA',
    setHistory: [
      {
        setNumber: 1,
        teamAGames: 6,
        teamBGames: 3
      }
    ]
  }

  return {
    ...runtimeState,
    ...overrides,
    setsWon: {
      ...runtimeState.setsWon,
      ...overrides.setsWon
    },
    setHistory: Array.isArray(overrides.setHistory)
      ? overrides.setHistory
      : runtimeState.setHistory
  }
}

function serializePersistedMatchState(overrides = {}) {
  return JSON.stringify(createFinishedPersistedMatchState(overrides))
}

function getVisibleWidgets(createdWidgets, type) {
  return createdWidgets.filter((widget) => widget.type === type && !widget.deleted)
}

function getVisibleButtonLabels(createdWidgets) {
  return getVisibleWidgets(createdWidgets, 'BUTTON').map(
    (widget) => widget.properties.text
  )
}

function findButtonByText(createdWidgets, text) {
  return getVisibleWidgets(createdWidgets, 'BUTTON').find(
    (widget) => widget.properties.text === text
  )
}

function getVisibleTextValues(createdWidgets) {
  return getVisibleWidgets(createdWidgets, 'TEXT').map((widget) => widget.properties.text)
}

async function waitForAsyncPageUpdates() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

async function loadSummaryPageDefinition() {
  const sourceUrl = new URL('../page/summary.js', import.meta.url)
  const historyStackUrl = new URL('../utils/history-stack.js', import.meta.url)
  const matchStorageUrl = new URL('../utils/match-storage.js', import.meta.url)
  const matchStateSchemaUrl = new URL('../utils/match-state-schema.js', import.meta.url)
  const matchStateUrl = new URL('../utils/match-state.js', import.meta.url)
  const storageUrl = new URL('../utils/storage.js', import.meta.url)

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace("import { gettext } from 'i18n'\n", 'const gettext = (key) => key\n')
    .replace("from '../utils/history-stack.js'", `from '${historyStackUrl.href}'`)
    .replace("from '../utils/match-storage.js'", `from '${matchStorageUrl.href}'`)
    .replace("from '../utils/match-state-schema.js'", `from '${matchStateSchemaUrl.href}'`)
    .replace("from '../utils/match-state.js'", `from '${matchStateUrl.href}'`)
    .replace("from '../utils/storage.js'", `from '${storageUrl.href}'`)

  const moduleUrl =
    'data:text/javascript;charset=utf-8,' +
    encodeURIComponent(source) +
    `#summary-screen-${Date.now()}-${summaryPageImportCounter}`

  summaryPageImportCounter += 1

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
    throw new Error('Page definition was not registered by page/summary.js.')
  }

  return capturedDefinition
}

async function runSummaryPageScenario(options = {}, runAssertions) {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp
  const originalGetApp = globalThis.getApp
  const originalSettingsStorage = globalThis.settingsStorage
  const originalMatchStorageAdapter = matchStorage.adapter

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const navigationCalls = []
  const removedLegacyStorageKeys = []
  const loadedMatchStorageKeys = []
  const clearedMatchStorageKeys = []

  const app =
    options.app ||
    {
      globalData: {
        matchState: options.runtimeMatchState ?? createInitialMatchState(1700000001),
        matchHistory: {
          clearCalls: 0,
          clear() {
            this.clearCalls += 1
          }
        }
      }
    }

  const loadResponses = Array.isArray(options.matchStorageLoadResponses)
    ? options.matchStorageLoadResponses
    : [null]
  let loadCallCount = 0

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }
  globalThis.hmApp = {
    gotoPage(payload) {
      navigationCalls.push(payload)
    }
  }
  globalThis.getApp = () => app
  globalThis.settingsStorage = {
    getItem() {
      return null
    },
    setItem() {},
    removeItem(key) {
      removedLegacyStorageKeys.push(key)
    }
  }

  matchStorage.adapter = {
    async save() {},
    async load(key) {
      loadedMatchStorageKeys.push(key)
      const responseIndex = Math.min(loadCallCount, loadResponses.length - 1)
      const nextResponse = loadResponses[responseIndex]
      loadCallCount += 1

      if (nextResponse instanceof Error) {
        throw nextResponse
      }

      return nextResponse
    },
    async clear(key) {
      clearedMatchStorageKeys.push(key)
    }
  }

  try {
    const definition = await loadSummaryPageDefinition()
    const page = createPageInstance(definition)

    page.onInit()
    page.build()
    await waitForAsyncPageUpdates()

    return await runAssertions({
      app,
      createdWidgets,
      page,
      navigationCalls,
      removedLegacyStorageKeys,
      loadedMatchStorageKeys,
      clearedMatchStorageKeys,
      getVisibleWidgets,
      getVisibleTextValues,
      getVisibleButtonLabels,
      findButtonByText
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

    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }

    if (typeof originalGetApp === 'undefined') {
      delete globalThis.getApp
    } else {
      globalThis.getApp = originalGetApp
    }

    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }

    matchStorage.adapter = originalMatchStorageAdapter
  }
}

test('summary screen renders winner, final score, and ordered set history from persisted finished state', async () => {
  const finishedState = serializePersistedMatchState({
    winnerTeam: 'teamA',
    setsWon: {
      teamA: 2,
      teamB: 1
    },
    setHistory: [
      {
        setNumber: 2,
        teamAGames: 4,
        teamBGames: 6
      },
      {
        setNumber: 1,
        teamAGames: 6,
        teamBGames: 4
      },
      {
        setNumber: 3,
        teamAGames: 6,
        teamBGames: 2
      }
    ]
  })

  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [finishedState]
    },
    async ({ createdWidgets, loadedMatchStorageKeys }) => {
      const textValues = getVisibleTextValues(createdWidgets)

      assert.equal(textValues.includes('summary.teamAWins'), true)
      assert.equal(textValues.includes('2-1'), true)
      assert.equal(textValues.includes('Set 1: 6-4'), true)
      assert.equal(textValues.includes('Set 2: 4-6'), true)
      assert.equal(textValues.includes('Set 3: 6-2'), true)
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'summary.home',
        'summary.startNewGame'
      ])
      assert.deepEqual(loadedMatchStorageKeys, [ACTIVE_MATCH_SESSION_STORAGE_KEY])
    }
  )
})

test('summary screen falls back to sets-won comparison when winner metadata is missing', async () => {
  const finishedStateWithoutWinner = serializePersistedMatchState({
    winnerTeam: undefined,
    winner: undefined,
    setsWon: {
      teamA: 0,
      teamB: 2
    }
  })

  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [finishedStateWithoutWinner]
    },
    async ({ createdWidgets }) => {
      const textValues = getVisibleTextValues(createdWidgets)

      assert.equal(textValues.includes('summary.teamBWins'), true)
      assert.equal(textValues.includes('summary.teamAWins'), false)
      assert.equal(textValues.includes('0-2'), true)
    }
  )
})

test('summary screen uses runtime finished state when persisted session is unavailable', async () => {
  const runtimeFinishedState = createFinishedRuntimeMatchState({
    setsWon: {
      teamA: 1,
      teamB: 0
    },
    setHistory: [
      {
        setNumber: 1,
        teamAGames: 6,
        teamBGames: 3
      }
    ]
  })

  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [null],
      runtimeMatchState: runtimeFinishedState
    },
    async ({ createdWidgets }) => {
      const textValues = getVisibleTextValues(createdWidgets)

      assert.equal(textValues.includes('summary.teamAWins'), true)
      assert.equal(textValues.includes('1-0'), true)
      assert.equal(textValues.includes('Set 1: 6-3'), true)
    }
  )
})

test('summary screen shows fallback copy when no finished data is available', async () => {
  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [null]
    },
    async ({ createdWidgets }) => {
      const textValues = getVisibleTextValues(createdWidgets)

      assert.equal(textValues.includes('summary.matchUnavailable'), true)
      assert.equal(textValues.includes('summary.noSetHistory'), true)
      assert.equal(textValues.includes('0-0'), true)
    }
  )
})

test('summary home button navigates to home screen', async () => {
  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [serializePersistedMatchState()]
    },
    async ({ createdWidgets, navigationCalls }) => {
      const homeButton = findButtonByText(createdWidgets, 'summary.home')

      assert.equal(typeof homeButton?.properties.click_func, 'function')

      homeButton.properties.click_func()

      assert.deepEqual(navigationCalls, [{ url: 'page/index' }])
    }
  )
})

test('summary start-new-game button clears state, resets runtime manager, and navigates to setup', async () => {
  const app = {
    globalData: {
      matchState: createFinishedRuntimeMatchState(),
      matchHistory: {
        clearCalls: 0,
        clear() {
          this.clearCalls += 1
        }
      }
    }
  }

  await runSummaryPageScenario(
    {
      app,
      matchStorageLoadResponses: [serializePersistedMatchState()]
    },
    async ({
      app,
      createdWidgets,
      navigationCalls,
      removedLegacyStorageKeys,
      clearedMatchStorageKeys
    }) => {
      const startButton = findButtonByText(createdWidgets, 'summary.startNewGame')

      assert.equal(typeof startButton?.properties.click_func, 'function')

      await startButton.properties.click_func()

      assert.deepEqual(removedLegacyStorageKeys, [MATCH_STATE_STORAGE_KEY])
      assert.deepEqual(clearedMatchStorageKeys, [ACTIVE_MATCH_SESSION_STORAGE_KEY])
      assert.deepEqual(app.globalData.matchState, createInitialMatchState())
      assert.equal(app.globalData.matchHistory.clearCalls, 1)
      assert.deepEqual(navigationCalls, [{ url: 'page/setup' }])
    }
  )
})

test('app routes register summary screen for both targets', async () => {
  const appConfigPath = new URL('../app.json', import.meta.url)
  const appConfig = JSON.parse(await readFile(appConfigPath, 'utf8'))

  assert.equal(
    appConfig.targets['gtr-3'].module.page.pages.includes('page/summary'),
    true
  )
  assert.equal(
    appConfig.targets['gts-3'].module.page.pages.includes('page/summary'),
    true
  )
})
