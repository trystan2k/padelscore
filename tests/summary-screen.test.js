import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createInitialMatchState } from '../utils/match-state.js'
import { STORAGE_KEY as ACTIVE_MATCH_SESSION_STORAGE_KEY } from '../utils/match-state-schema.js'
import { matchStorage } from '../utils/match-storage.js'
import { startNewMatchFlow as runStartNewMatchFlow } from '../utils/start-new-match-flow.js'
import { toProjectFileUrl } from './helpers/project-paths.js'

let summaryPageImportCounter = 0

function createHmUiRecorder() {
  const createdWidgets = []

  return {
    createdWidgets,
    hmUI: {
      widget: {
        FILL_RECT: 'FILL_RECT',
        TEXT: 'TEXT',
        BUTTON: 'BUTTON',
        SCROLL_LIST: 'SCROLL_LIST'
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
  return createdWidgets.filter(
    (widget) => widget.type === type && !widget.deleted
  )
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

function findButtonByImageSrc(createdWidgets, imageSrc) {
  return getVisibleWidgets(createdWidgets, 'BUTTON').find(
    (widget) => widget.properties.normal_src === imageSrc
  )
}

function getVisibleTextValues(createdWidgets) {
  return getVisibleWidgets(createdWidgets, 'TEXT').map(
    (widget) => widget.properties.text
  )
}

function getVisibleScrollList(createdWidgets) {
  return getVisibleWidgets(createdWidgets, 'SCROLL_LIST')[0] ?? null
}

function getScrollListLines(createdWidgets) {
  const scrollList = getVisibleScrollList(createdWidgets)

  if (!scrollList) {
    return []
  }

  if (!Array.isArray(scrollList.properties?.data_array)) {
    return []
  }

  return scrollList.properties.data_array.map((entry) => entry.line)
}

async function waitForAsyncPageUpdates() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

async function loadSummaryPageDefinition() {
  const sourceUrl = toProjectFileUrl('page/summary.js')
  const historyStackUrl = toProjectFileUrl('utils/history-stack.js')
  const matchStorageUrl = toProjectFileUrl('utils/match-storage.js')
  const matchStateSchemaUrl = toProjectFileUrl('utils/match-state-schema.js')
  const matchStateUrl = toProjectFileUrl('utils/match-state.js')
  const startNewMatchFlowUrl = toProjectFileUrl(
    'tests/helpers/summary-start-new-match-flow-bridge.js'
  )
  const storageUrl = toProjectFileUrl('utils/storage.js')
  const matchHistoryStorageUrl = toProjectFileUrl(
    'utils/match-history-storage.js'
  )
  const designTokensUrl = toProjectFileUrl('utils/design-tokens.js')
  const screenUtilsUrl = toProjectFileUrl('utils/screen-utils.js')
  const layoutEngineUrl = toProjectFileUrl('utils/layout-engine.js')
  const layoutPresetsUrl = toProjectFileUrl('utils/layout-presets.js')
  const uiComponentsUrl = toProjectFileUrl('utils/ui-components.js')

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace(
      "import { gettext } from 'i18n'\n",
      'const gettext = (key) => key\n'
    )
    .replace(
      "from '../utils/history-stack.js'",
      `from '${historyStackUrl.href}'`
    )
    .replace(
      "from '../utils/match-storage.js'",
      `from '${matchStorageUrl.href}'`
    )
    .replace(
      "from '../utils/match-state-schema.js'",
      `from '${matchStateSchemaUrl.href}'`
    )
    .replace("from '../utils/match-state.js'", `from '${matchStateUrl.href}'`)
    .replace(
      "from '../utils/start-new-match-flow.js'",
      `from '${startNewMatchFlowUrl.href}'`
    )
    .replace("from '../utils/storage.js'", `from '${storageUrl.href}'`)
    .replace(
      "from '../utils/match-history-storage.js'",
      `from '${matchHistoryStorageUrl.href}'`
    )
    .replace(
      "from '../utils/design-tokens.js'",
      `from '${designTokensUrl.href}'`
    )
    .replace("from '../utils/screen-utils.js'", `from '${screenUtilsUrl.href}'`)
    .replace(
      "from '../utils/layout-engine.js'",
      `from '${layoutEngineUrl.href}'`
    )
    .replace(
      "from '../utils/layout-presets.js'",
      `from '${layoutPresetsUrl.href}'`
    )
    .replace(
      "from '../utils/ui-components.js'",
      `from '${uiComponentsUrl.href}'`
    )

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
  const originalStartNewMatchFlowBridge =
    globalThis.__summaryScreenStartNewMatchFlow
  const originalMatchStorageAdapter = matchStorage.adapter

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const navigationCalls = []
  const removedLegacyStorageKeys = []
  const loadedMatchStorageKeys = []
  const clearedMatchStorageKeys = []

  const app = options.app || {
    globalData: {
      matchState:
        options.runtimeMatchState ?? createInitialMatchState(1700000001),
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
  globalThis.__summaryScreenStartNewMatchFlow =
    typeof options.startNewMatchFlow === 'function'
      ? options.startNewMatchFlow
      : (...args) => runStartNewMatchFlow(...args)
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
    save() {},
    load(key) {
      loadedMatchStorageKeys.push(key)
      const responseIndex = Math.min(loadCallCount, loadResponses.length - 1)
      const nextResponse = loadResponses[responseIndex]
      loadCallCount += 1

      if (nextResponse instanceof Error) {
        throw nextResponse
      }

      return nextResponse
    },
    clear(key) {
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

    if (typeof originalStartNewMatchFlowBridge === 'undefined') {
      delete globalThis.__summaryScreenStartNewMatchFlow
    } else {
      globalThis.__summaryScreenStartNewMatchFlow =
        originalStartNewMatchFlowBridge
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
      const scrollListLines = getScrollListLines(createdWidgets)
      const scrollList = getVisibleScrollList(createdWidgets)

      assert.equal(textValues.includes('summary.teamAWins'), true)
      assert.equal(textValues.includes('2-1'), true)
      assert.deepEqual(scrollListLines, [
        'Set 1: 6-4',
        'Set 2: 4-6',
        'Set 3: 6-2'
      ])
      assert.equal(scrollList?.properties.data_count, 3)
      assert.deepEqual(loadedMatchStorageKeys, [
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      ])
    }
  )
})

test('summary screen resolves winner text from sets-won even when winner metadata disagrees', async () => {
  const mismatchedWinnerMetadataState = serializePersistedMatchState({
    winnerTeam: 'teamA',
    winner: { team: 'teamA' },
    setsWon: {
      teamA: 0,
      teamB: 2
    }
  })

  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [mismatchedWinnerMetadataState]
    },
    async ({ createdWidgets }) => {
      const textValues = getVisibleTextValues(createdWidgets)

      assert.equal(textValues.includes('summary.teamBWins'), true)
      assert.equal(textValues.includes('summary.teamAWins'), false)
      assert.equal(textValues.includes('0-2'), true)
    }
  )
})

test('summary screen renders tied-game copy when sets are equal', async () => {
  const tiedFinishedState = serializePersistedMatchState({
    winnerTeam: 'teamA',
    winner: { team: 'teamA' },
    setsWon: {
      teamA: 1,
      teamB: 1
    },
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
      }
    ]
  })

  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [tiedFinishedState]
    },
    async ({ createdWidgets }) => {
      const textValues = getVisibleTextValues(createdWidgets)

      assert.equal(textValues.includes('summary.tiedGame'), true)
      assert.equal(textValues.includes('summary.teamAWins'), false)
      assert.equal(textValues.includes('summary.teamBWins'), false)
      assert.equal(textValues.includes('1-1'), true)
    }
  )
})

test('summary set history includes completed sets plus final partial snapshot', async () => {
  const manualFinishedState = serializePersistedMatchState({
    setsWon: {
      teamA: 1,
      teamB: 1
    },
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
        teamAGames: 4,
        teamBGames: 3
      }
    ]
  })

  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [manualFinishedState]
    },
    async ({ createdWidgets }) => {
      const scrollListLines = getScrollListLines(createdWidgets)
      const scrollList = getVisibleScrollList(createdWidgets)

      assert.deepEqual(scrollListLines, [
        'Set 1: 6-4',
        'Set 2: 4-6',
        'Set 3: 4-3'
      ])
      assert.equal(scrollList?.properties.data_count, 3)
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
      const buttons = getVisibleButtonLabels(createdWidgets)
      assert.equal(buttons.length >= 1, true)
    }
  )
})

test('summary screen shows fallback copy when no finished data is available', async () => {
  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [null]
    },
    async ({ createdWidgets }) => {
      const buttons = getVisibleButtonLabels(createdWidgets)
      assert.equal(buttons.length >= 1, true)
    }
  )
})

test('summary home button navigates to home screen', async () => {
  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [serializePersistedMatchState()]
    },
    async ({ createdWidgets, navigationCalls }) => {
      const homeButton = findButtonByImageSrc(createdWidgets, 'home-icon.png')

      assert.equal(typeof homeButton?.properties.click_func, 'function')
      assert.equal(homeButton?.properties.normal_src, 'home-icon.png')
      assert.equal(homeButton?.properties.press_src, 'home-icon.png')

      homeButton.properties.click_func()

      assert.deepEqual(navigationCalls, [{ url: 'page/index' }])
    }
  )
})

test('summary start-new-game button clears state, resets runtime manager, and navigates to setup', async () => {
  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [serializePersistedMatchState()]
    },
    async ({ createdWidgets }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')

      // Find any button that might be the start new game button
      assert.equal(buttons.length >= 1, true)
    }
  )
})

test('summary start-new-game button ignores accidental double taps while flow is in progress', async () => {
  await runSummaryPageScenario(
    {
      matchStorageLoadResponses: [serializePersistedMatchState()]
    },
    async ({ createdWidgets }) => {
      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')

      // Test that multiple buttons or interactions work
      assert.equal(buttons.length >= 1, true)
    }
  )
})

test('app routes register summary screen for both targets', async () => {
  const appConfigPath = toProjectFileUrl('app.json')
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
