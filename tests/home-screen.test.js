import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createInitialMatchState } from '../utils/match-state.js'
import { STORAGE_KEY as ACTIVE_MATCH_SESSION_STORAGE_KEY } from '../utils/match-state-schema.js'
import { matchStorage } from '../utils/match-storage.js'
import { startNewMatchFlow as runStartNewMatchFlow } from '../utils/start-new-match-flow.js'
import { MATCH_STATE_STORAGE_KEY } from '../utils/storage.js'
import { createHmFsMock, storageKeyToFilename } from './helpers/hmfs-mock.js'
import { toProjectFileUrl } from './helpers/project-paths.js'

let homePageImportCounter = 0

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

function createPersistedMatchState(overrides = {}) {
  const baseState = {
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
    setHistory: [],
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

function serializePersistedMatchState(overrides = {}) {
  return JSON.stringify(createPersistedMatchState(overrides))
}

function getVisibleButtons(createdWidgets) {
  return createdWidgets.filter(
    (widget) => widget.type === 'BUTTON' && !widget.deleted
  )
}

function getVisibleButtonLabels(createdWidgets) {
  return getVisibleButtons(createdWidgets)
    .map((widget) => widget.properties.text)
    .filter((text) => text !== undefined)
}

async function waitForAsyncPageUpdates() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

async function loadHomePageDefinition() {
  const sourceUrl = toProjectFileUrl('page/index.js')
  const historyStackUrl = toProjectFileUrl('utils/history-stack.js')
  const matchStorageUrl = toProjectFileUrl('utils/match-storage.js')
  const matchStateSchemaUrl = toProjectFileUrl('utils/match-state-schema.js')
  const matchStateUrl = toProjectFileUrl('utils/match-state.js')
  const startNewMatchFlowUrl = toProjectFileUrl(
    'tests/helpers/home-start-new-match-flow-bridge.js'
  )
  const constantsUrl = toProjectFileUrl('utils/constants.js')
  const storageUrl = toProjectFileUrl('utils/storage.js')
  const validationUrl = toProjectFileUrl('utils/validation.js')
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
    .replace("from '../utils/constants.js'", `from '${constantsUrl.href}'`)
    .replace("from '../utils/storage.js'", `from '${storageUrl.href}'`)
    .replace("from '../utils/validation.js'", `from '${validationUrl.href}'`)
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
    `#home-screen-${Date.now()}-${homePageImportCounter}`

  homePageImportCounter += 1

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
    throw new Error('Page definition was not registered by page/index.js.')
  }

  return capturedDefinition
}

async function runHomePageScenario(options = {}, runAssertions) {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp
  const originalGetApp = globalThis.getApp
  const originalHmFS = globalThis.hmFS
  const originalSettingsStorage = globalThis.settingsStorage
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const originalStartNewMatchFlowBridge =
    globalThis.__homeScreenStartNewMatchFlow
  const originalClearActiveMatchSessionBridge =
    globalThis.__homeScreenClearActiveMatchSession
  const originalResetMatchStateManagerBridge =
    globalThis.__homeScreenResetMatchStateManager
  const originalMatchStorageAdapter = matchStorage.adapter

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const navigationCalls = []
  const removedLegacyStorageKeys = []
  const loadedMatchStorageKeys = []
  const clearedMatchStorageKeys = []
  const app = options.app || {
    globalData: {
      matchState: createInitialMatchState(1700000000),
      matchHistory: {
        clearCalls: 0,
        clear() {
          this.clearCalls += 1
        }
      }
    }
  }

  let loadCallCount = 0
  const loadResponses = Array.isArray(options.matchStorageLoadResponses)
    ? options.matchStorageLoadResponses
    : [null]

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
  globalThis.__homeScreenStartNewMatchFlow =
    typeof options.startNewMatchFlow === 'function'
      ? options.startNewMatchFlow
      : (...args) => runStartNewMatchFlow(...args)
  globalThis.__homeScreenClearActiveMatchSession =
    typeof options.clearActiveMatchSession === 'function'
      ? options.clearActiveMatchSession
      : () => {}
  globalThis.__homeScreenResetMatchStateManager =
    typeof options.resetMatchStateManager === 'function'
      ? options.resetMatchStateManager
      : () => {}
  globalThis.setTimeout =
    typeof options.setTimeoutFn === 'function'
      ? options.setTimeoutFn
      : originalSetTimeout
  globalThis.clearTimeout =
    typeof options.clearTimeoutFn === 'function'
      ? options.clearTimeoutFn
      : originalClearTimeout
  // Build a file-based hmFS mock.
  // If legacyRuntimeState is provided, pre-seed it as padel-buddy.match-state.json
  // so the file-based storage layer reads it back.
  const legacyFilename = storageKeyToFilename(MATCH_STATE_STORAGE_KEY)
  const initialFiles = {}
  if (options.legacyRuntimeState) {
    initialFiles[legacyFilename] = options.legacyRuntimeState
  }
  const { mock: hmFsMock } = createHmFsMock(initialFiles)

  // Wrap remove() to map filename → original storage key and push into removedLegacyStorageKeys.
  const originalRemove = hmFsMock.remove.bind(hmFsMock)
  hmFsMock.remove = (filename) => {
    if (filename === legacyFilename) {
      removedLegacyStorageKeys.push(MATCH_STATE_STORAGE_KEY)
    }
    originalRemove(filename)
  }
  globalThis.hmFS = hmFsMock

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
    const definition = await loadHomePageDefinition()
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
      getVisibleButtons,
      getVisibleButtonLabels
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

    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }

    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
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

    if (typeof originalStartNewMatchFlowBridge === 'undefined') {
      delete globalThis.__homeScreenStartNewMatchFlow
    } else {
      globalThis.__homeScreenStartNewMatchFlow = originalStartNewMatchFlowBridge
    }

    if (typeof originalClearActiveMatchSessionBridge === 'undefined') {
      delete globalThis.__homeScreenClearActiveMatchSession
    } else {
      globalThis.__homeScreenClearActiveMatchSession =
        originalClearActiveMatchSessionBridge
    }

    if (typeof originalResetMatchStateManagerBridge === 'undefined') {
      delete globalThis.__homeScreenResetMatchStateManager
    } else {
      globalThis.__homeScreenResetMatchStateManager =
        originalResetMatchStateManagerBridge
    }

    matchStorage.adapter = originalMatchStorageAdapter
  }
}

test('home screen resume visibility uses active persisted session state only', async () => {
  const activeState = serializePersistedMatchState({ status: 'active' })
  const finishedState = serializePersistedMatchState({ status: 'finished' })

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [activeState]
    },
    async ({ createdWidgets, loadedMatchStorageKeys }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame',
        'home.resumeGame'
      ])
      assert.deepEqual(loadedMatchStorageKeys, [
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      ])
    }
  )

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [finishedState]
    },
    async ({ createdWidgets }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame'
      ])
    }
  )

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [null]
    },
    async ({ createdWidgets }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame'
      ])
    }
  )
})

test('home screen refreshes resume visibility on re-init (v1.0 lifecycle) using loadMatchState', async () => {
  const activeState = serializePersistedMatchState({ status: 'active' })

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [null, activeState]
    },
    async ({ createdWidgets, page, loadedMatchStorageKeys }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame'
      ])

      page.onDestroy()
      page.onInit()
      page.build()
      await waitForAsyncPageUpdates()

      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame',
        'home.resumeGame'
      ])
      assert.deepEqual(loadedMatchStorageKeys, [
        ACTIVE_MATCH_SESSION_STORAGE_KEY,
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      ])
    }
  )
})

test('home screen hides Resume for invalid, corrupt, or load-failure payloads', async () => {
  await runHomePageScenario(
    {
      matchStorageLoadResponses: [JSON.stringify({ invalid: true })]
    },
    async ({ createdWidgets }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame'
      ])
    }
  )

  await runHomePageScenario(
    {
      matchStorageLoadResponses: ['not-json{{{']
    },
    async ({ createdWidgets }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame'
      ])
    }
  )

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [new Error('load failed')]
    },
    async ({ createdWidgets }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame'
      ])
    }
  )
})

test('home screen start button requires confirmation before running hard reset flow', async () => {
  const savedState = createInitialMatchState(1700000002)
  let startNewMatchFlowCalls = 0

  await runHomePageScenario(
    {
      legacyRuntimeState: JSON.stringify(savedState),
      matchStorageLoadResponses: [
        serializePersistedMatchState({ status: 'active' })
      ],
      startNewMatchFlow() {
        startNewMatchFlowCalls += 1
        return runStartNewMatchFlow()
      }
    },
    async ({
      app,
      createdWidgets,
      navigationCalls,
      removedLegacyStorageKeys,
      clearedMatchStorageKeys
    }) => {
      const startButton = getVisibleButtons(createdWidgets).find(
        (widget) => widget.properties.text === 'home.startNewGame'
      )

      assert.ok(startButton)

      await startButton.properties.click_func()

      assert.equal(startNewMatchFlowCalls, 1)
      assert.deepEqual(removedLegacyStorageKeys, [MATCH_STATE_STORAGE_KEY])
      assert.deepEqual(clearedMatchStorageKeys, [
        ACTIVE_MATCH_SESSION_STORAGE_KEY
      ])
      assert.deepEqual(app.globalData.matchState, createInitialMatchState())
      assert.equal(app.globalData.matchHistory.clearCalls, 1)
      assert.equal(startNewMatchFlowCalls, 1)
      assert.deepEqual(navigationCalls, [{ url: 'page/setup' }])
    }
  )
})

test('home screen hard reset confirmation expires and returns to default start button', async () => {
  let startNewMatchFlowCalls = 0

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [
        serializePersistedMatchState({ status: 'active' })
      ],
      startNewMatchFlow() {
        startNewMatchFlowCalls += 1
        return Promise.resolve({ navigatedToSetup: true })
      }
    },
    async ({ createdWidgets }) => {
      const startButton = getVisibleButtons(createdWidgets).find(
        (widget) => widget.properties.text === 'home.startNewGame'
      )

      assert.ok(startButton)

      await startButton.properties.click_func()

      assert.equal(startNewMatchFlowCalls, 1)
    }
  )
})

test('home resume click reloads active session, restores runtime manager, and navigates', async () => {
  const initialResumeState = serializePersistedMatchState({
    currentSet: {
      number: 2,
      games: {
        teamA: 1,
        teamB: 1
      }
    },
    currentGame: {
      points: {
        teamA: 15,
        teamB: 15
      }
    }
  })

  const resumedState = serializePersistedMatchState({
    setsToPlay: 5,
    setsNeededToWin: 3,
    setsWon: {
      teamA: 1,
      teamB: 2
    },
    currentSet: {
      number: 4,
      games: {
        teamA: 5,
        teamB: 4
      }
    },
    currentGame: {
      points: {
        teamA: 50,
        teamB: 30
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
        teamAGames: 4,
        teamBGames: 6
      }
    ],
    updatedAt: 1700001200
  })

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [initialResumeState, resumedState]
    },
    async ({
      app,
      createdWidgets,
      navigationCalls,
      loadedMatchStorageKeys
    }) => {
      const resumeButton = getVisibleButtons(createdWidgets).find(
        (widget) => widget.properties.text === 'home.resumeGame'
      )

      assert.ok(resumeButton)

      await resumeButton.properties.click_func()

      assert.equal(loadedMatchStorageKeys.length, 2)
      assert.deepEqual(navigationCalls, [{ url: 'page/game' }])
      assert.equal(app.globalData.matchHistory.clearCalls, 1)

      const restoredState = app.globalData.matchState

      assert.equal(restoredState.status, 'active')
      assert.equal(restoredState.currentSet, 4)
      assert.equal(restoredState.currentSetStatus.number, 4)
      assert.equal(restoredState.currentSetStatus.teamAGames, 5)
      assert.equal(restoredState.currentSetStatus.teamBGames, 4)
      assert.equal(restoredState.teamA.games, 5)
      assert.equal(restoredState.teamB.games, 4)
      assert.equal(restoredState.teamA.points, 'Ad')
      assert.equal(restoredState.teamB.points, 30)
      assert.equal(restoredState.setsNeededToWin, 3)
      assert.deepEqual(restoredState.setsWon, {
        teamA: 1,
        teamB: 2
      })
      assert.deepEqual(restoredState.setHistory, [
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
          teamAGames: 4,
          teamBGames: 6
        }
      ])
      assert.equal(restoredState.updatedAt, 1700001200)
    }
  )
})

test('home resume click fails safe when reloaded session is no longer active', async () => {
  const activeState = serializePersistedMatchState({ status: 'active' })
  const finishedState = serializePersistedMatchState({ status: 'finished' })

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [activeState, finishedState]
    },
    async ({ app, createdWidgets, navigationCalls }) => {
      const initialRuntimeState = createInitialMatchState(1700000000)
      const resumeButton = getVisibleButtons(createdWidgets).find(
        (widget) => widget.properties.text === 'home.resumeGame'
      )

      assert.ok(resumeButton)

      await resumeButton.properties.click_func()

      assert.deepEqual(navigationCalls, [])
      assert.equal(app.globalData.matchHistory.clearCalls, 0)
      assert.deepEqual(app.globalData.matchState, initialRuntimeState)
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame'
      ])
    }
  )
})

test('home resume click fails safe when reloaded session throws', async () => {
  const activeState = serializePersistedMatchState({ status: 'active' })

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [activeState, new Error('reload failed')]
    },
    async ({ app, createdWidgets, navigationCalls }) => {
      const resumeButton = getVisibleButtons(createdWidgets).find(
        (widget) => widget.properties.text === 'home.resumeGame'
      )

      assert.ok(resumeButton)

      await resumeButton.properties.click_func()

      assert.deepEqual(navigationCalls, [])
      assert.equal(app.globalData.matchHistory.clearCalls, 0)
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame'
      ])
    }
  )
})
