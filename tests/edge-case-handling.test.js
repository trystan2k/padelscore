import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { isMatchState, STORAGE_KEY as ACTIVE_MATCH_SESSION_STORAGE_KEY } from '../utils/match-state-schema.js'
import { matchStorage, MatchStorage } from '../utils/match-storage.js'
import { initializeMatchState } from '../utils/match-session-init.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { startNewMatchFlow as runStartNewMatchFlow } from '../utils/start-new-match-flow.js'
import { createHistoryStack } from '../utils/history-stack.js'

// ─── Shared helpers ──────────────────────────────────────────────────────────

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

async function waitForAsyncPageUpdates() {
  // Game screen has a deeper async chain (5+ levels) than home screen (2-3 levels).
  // Using 10 ticks ensures all microtasks in the chain resolve before assertions.
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

function getVisibleButtons(createdWidgets) {
  return createdWidgets.filter((widget) => widget.type === 'BUTTON' && !widget.deleted)
}

function getVisibleButtonLabels(createdWidgets) {
  return getVisibleButtons(createdWidgets).map((widget) => widget.properties.text)
}

// ─── Home page loader ─────────────────────────────────────────────────────────

let homePageImportCounter = 0

async function loadHomePageDefinition() {
  const sourceUrl = new URL('../page/index.js', import.meta.url)
  const historyStackUrl = new URL('../utils/history-stack.js', import.meta.url)
  const matchStorageUrl = new URL('../utils/match-storage.js', import.meta.url)
  const matchStateSchemaUrl = new URL('../utils/match-state-schema.js', import.meta.url)
  const matchStateUrl = new URL('../utils/match-state.js', import.meta.url)
  const startNewMatchFlowUrl = new URL(
    './helpers/home-start-new-match-flow-bridge.js',
    import.meta.url
  )
  const storageUrl = new URL('../utils/storage.js', import.meta.url)

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace("import { gettext } from 'i18n'\n", 'const gettext = (key) => key\n')
    .replace("from '../utils/history-stack.js'", `from '${historyStackUrl.href}'`)
    .replace("from '../utils/match-storage.js'", `from '${matchStorageUrl.href}'`)
    .replace("from '../utils/match-state-schema.js'", `from '${matchStateSchemaUrl.href}'`)
    .replace("from '../utils/match-state.js'", `from '${matchStateUrl.href}'`)
    .replace(
      "from '../utils/start-new-match-flow.js'",
      `from '${startNewMatchFlowUrl.href}'`
    )
    .replace("from '../utils/storage.js'", `from '${storageUrl.href}'`)

  const moduleUrl =
    'data:text/javascript;charset=utf-8,' +
    encodeURIComponent(source) +
    `#edge-home-screen-${Date.now()}-${homePageImportCounter}`

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

// ─── Game page loader ─────────────────────────────────────────────────────────

let gamePageImportCounter = 0

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
    `#edge-game-screen-${Date.now()}-${gamePageImportCounter}`

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

// ─── Home page scenario runner ────────────────────────────────────────────────

async function runHomePageScenario(options = {}, runAssertions) {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp
  const originalGetApp = globalThis.getApp
  const originalSettingsStorage = globalThis.settingsStorage
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const originalStartNewMatchFlowBridge = globalThis.__homeScreenStartNewMatchFlow
  const originalMatchStorageAdapter = matchStorage.adapter

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const navigationCalls = []
  const app =
    options.app ||
    {
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
  globalThis.setTimeout =
    typeof options.setTimeoutFn === 'function' ? options.setTimeoutFn : originalSetTimeout
  globalThis.clearTimeout =
    typeof options.clearTimeoutFn === 'function' ? options.clearTimeoutFn : originalClearTimeout
  globalThis.settingsStorage = {
    getItem() {
      return options.legacyRuntimeState ?? null
    },
    removeItem() {}
  }

  matchStorage.adapter = {
    async save() {},
    async load() {
      const responseIndex = Math.min(loadCallCount, loadResponses.length - 1)
      const nextResponse = loadResponses[responseIndex]

      loadCallCount += 1

      if (nextResponse instanceof Error) {
        throw nextResponse
      }

      return nextResponse
    },
    async clear() {}
  }

  try {
    const definition = await loadHomePageDefinition()
    const page = createPageInstance(definition)

    page.onInit()
    page.build()
    await waitForAsyncPageUpdates()

    return await runAssertions({
      createdWidgets,
      page,
      navigationCalls,
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

    matchStorage.adapter = originalMatchStorageAdapter
  }
}

// ─── Game page scenario runner ────────────────────────────────────────────────

async function runGamePageSessionScenario(options = {}, runAssertions) {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp
  const originalGetApp = globalThis.getApp
  const originalMatchStorageAdapter = matchStorage.adapter

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const navigationCalls = []
  const app = {
    globalData: {
      matchState: createInitialMatchState(1700000000),
      matchHistory: createHistoryStack()
    }
  }

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

  matchStorage.adapter = {
    async save() {},
    async load() {
      if (typeof options.adapterLoad === 'function') {
        return options.adapterLoad()
      }

      return null
    },
    async clear() {}
  }

  try {
    const definition = await loadGamePageDefinition()
    const page = createPageInstance(definition)

    page.onInit()
    await waitForAsyncPageUpdates()

    return await runAssertions({
      app,
      createdWidgets,
      page,
      navigationCalls
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

    matchStorage.adapter = originalMatchStorageAdapter
  }
}

// ─── Tests 1–3: Scenario 1 – 0-point active state ────────────────────────────

test('initializeMatchState(3) produces a schema-valid 0-point active state', () => {
  const state = initializeMatchState(3)

  assert.equal(isMatchState(state), true)
  assert.equal(state.status, 'active')
  assert.equal(state.currentGame.points.teamA, 0)
  assert.equal(state.currentGame.points.teamB, 0)
  assert.equal(state.currentSet.number, 1)
  assert.deepEqual(state.setHistory, [])
})

test('loadMatchState correctly loads and validates a 0-point active state save-load roundtrip', async () => {
  const store = new Map()
  const inMemoryAdapter = {
    async save(key, value) {
      store.set(key, value)
    },
    async load(key) {
      return store.has(key) ? store.get(key) : null
    },
    async clear(key) {
      store.delete(key)
    }
  }
  const storage = new MatchStorage(inMemoryAdapter)

  await storage.saveMatchState(initializeMatchState(3))

  const result = await storage.loadMatchState()

  assert.notEqual(result, null)
  assert.equal(result.status, 'active')
  assert.equal(isMatchState(result), true)
  assert.equal(result.currentGame.points.teamA, 0)
  assert.equal(result.currentGame.points.teamB, 0)
  assert.deepEqual(result.setHistory, [])
})

test('home screen shows Resume when storage contains a 0-point active state', async () => {
  const zeroPointActiveState = JSON.stringify(initializeMatchState(3))

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [zeroPointActiveState]
    },
    async ({ createdWidgets }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), [
        'home.startNewGame',
        'home.resumeGame'
      ])
    }
  )
})

// ─── Tests 4–6: Scenario 2 – Partial / corrupt state ─────────────────────────

test('home screen hides Resume for partial state missing schemaVersion', async () => {
  const partialState = JSON.stringify({
    status: 'active',
    setsToPlay: 3,
    setsNeededToWin: 2,
    setsWon: { teamA: 0, teamB: 0 },
    currentSet: { number: 1, games: { teamA: 0, teamB: 0 } },
    currentGame: { points: { teamA: 0, teamB: 0 } },
    setHistory: [],
    updatedAt: Date.now()
    // schemaVersion is intentionally absent
  })

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [partialState]
    },
    async ({ createdWidgets }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), ['home.startNewGame'])
    }
  )
})

test('home screen hides Resume for state missing setHistory', async () => {
  const partialState = JSON.stringify({
    status: 'active',
    setsToPlay: 3,
    setsNeededToWin: 2,
    setsWon: { teamA: 0, teamB: 0 },
    currentSet: { number: 1, games: { teamA: 0, teamB: 0 } },
    currentGame: { points: { teamA: 0, teamB: 0 } },
    // setHistory is intentionally absent
    updatedAt: Date.now(),
    schemaVersion: 1
  })

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [partialState]
    },
    async ({ createdWidgets }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), ['home.startNewGame'])
    }
  )
})

test('home screen hides Resume for state with currentSet.number equal to 0', async () => {
  const invalidState = JSON.stringify({
    status: 'active',
    setsToPlay: 3,
    setsNeededToWin: 2,
    setsWon: { teamA: 0, teamB: 0 },
    currentSet: { number: 0, games: { teamA: 0, teamB: 0 } }, // 0 fails isPositiveInteger
    currentGame: { points: { teamA: 0, teamB: 0 } },
    setHistory: [],
    updatedAt: Date.now(),
    schemaVersion: 1
  })

  await runHomePageScenario(
    {
      matchStorageLoadResponses: [invalidState]
    },
    async ({ createdWidgets }) => {
      assert.deepEqual(getVisibleButtonLabels(createdWidgets), ['home.startNewGame'])
    }
  )
})

// ─── Tests 7–9: Scenario 3 – Game screen session guard (redirect) ─────────────

test('game screen redirects to setup when loadMatchState returns null', async () => {
  await runGamePageSessionScenario(
    {
      adapterLoad() {
        return null
      }
    },
    async ({ page, navigationCalls }) => {
      assert.equal(page.isSessionAccessGranted, false)
      assert.deepEqual(navigationCalls, [{ url: 'page/setup' }])
    }
  )
})

test('game screen redirects to setup when loadMatchState returns a finished state', async () => {
  const finishedState = JSON.stringify({
    ...initializeMatchState(3),
    status: 'finished'
  })

  await runGamePageSessionScenario(
    {
      adapterLoad() {
        return finishedState
      }
    },
    async ({ page, navigationCalls }) => {
      assert.equal(page.isSessionAccessGranted, false)
      assert.deepEqual(navigationCalls, [{ url: 'page/setup' }])
    }
  )
})

test('game screen redirects to setup when adapter.load throws', async () => {
  await runGamePageSessionScenario(
    {
      adapterLoad() {
        throw new Error('storage unavailable')
      }
    },
    async ({ page, navigationCalls }) => {
      assert.equal(page.isSessionAccessGranted, false)
      assert.deepEqual(navigationCalls, [{ url: 'page/setup' }])
    }
  )
})

// ─── Tests 10–11: Session guard in renderGameScreen() and build() ─────────────

test('renderGameScreen() is a no-op when isSessionAccessGranted is false', async () => {
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
      return { width: 390, height: 450 }
    }
  }
  globalThis.getApp = () => app

  // Stub out adapter so onInit's async session check does not interfere
  matchStorage.adapter = {
    async save() {},
    async load() {
      return null
    },
    async clear() {}
  }

  try {
    const definition = await loadGamePageDefinition()
    const page = createPageInstance(definition)

    // Initialize page properties without triggering async session validation
    page.isSessionAccessGranted = false
    page.widgets = []
    page.persistedSessionState = null

    page.renderGameScreen()

    assert.equal(createdWidgets.length, 0)
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
})

test('build() returns early without rendering when isSessionAccessGranted is false', async () => {
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
      return { width: 390, height: 450 }
    }
  }
  globalThis.getApp = () => app

  // Stub out adapter so async session check resolves to invalid (null)
  matchStorage.adapter = {
    async save() {},
    async load() {
      return null
    },
    async clear() {}
  }

  try {
    const definition = await loadGamePageDefinition()
    const page = createPageInstance(definition)

    // Simulate state after failed session validation (isSessionAccessGranted remains false)
    page.isSessionAccessGranted = false
    page.widgets = []

    page.build()

    assert.equal(createdWidgets.length, 0)
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
})
