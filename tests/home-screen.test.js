import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { STORAGE_KEY as ACTIVE_MATCH_SESSION_STORAGE_KEY } from '../utils/match-state-schema.js'
import { matchStorage } from '../utils/match-storage.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { MATCH_STATE_STORAGE_KEY } from '../utils/storage.js'

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

async function loadHomePageDefinition() {
  const sourceUrl = new URL('../page/index.js', import.meta.url)
  const historyStackUrl = new URL('../utils/history-stack.js', import.meta.url)
  const matchStorageUrl = new URL('../utils/match-storage.js', import.meta.url)
  const matchStateUrl = new URL('../utils/match-state.js', import.meta.url)
  const storageUrl = new URL('../utils/storage.js', import.meta.url)

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace("import { gettext } from 'i18n'\n", 'const gettext = (key) => key\n')
    .replace("from '../utils/history-stack.js'", `from '${historyStackUrl.href}'`)
    .replace("from '../utils/match-storage.js'", `from '${matchStorageUrl.href}'`)
    .replace("from '../utils/match-state.js'", `from '${matchStateUrl.href}'`)
    .replace("from '../utils/storage.js'", `from '${storageUrl.href}'`)

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

test('home screen hides Resume button when no saved game exists', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp
  const originalGetApp = globalThis.getApp
  const originalSettingsStorage = globalThis.settingsStorage

  const { hmUI, createdWidgets } = createHmUiRecorder()

  let capturedStorageKey = ''

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }
  globalThis.hmApp = {
    gotoPage() {}
  }
  globalThis.getApp = () => ({ globalData: {} })
  globalThis.settingsStorage = {
    getItem(key) {
      capturedStorageKey = key
      return null
    },
    removeItem() {}
  }

  try {
    const definition = await loadHomePageDefinition()
    const page = createPageInstance(definition)

    page.onInit()
    page.build()
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
  }

  const visibleButtons = createdWidgets.filter(
    (widget) => widget.type === 'BUTTON' && !widget.deleted
  )
  const buttonLabels = visibleButtons.map((widget) => widget.properties.text)

  assert.equal(capturedStorageKey, MATCH_STATE_STORAGE_KEY)
  assert.deepEqual(buttonLabels, ['home.startNewGame'])
})

test('home screen start button clears persisted state, resets runtime state, and navigates', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp
  const originalGetApp = globalThis.getApp
  const originalSettingsStorage = globalThis.settingsStorage
  const originalMatchStorageAdapter = matchStorage.adapter

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const savedState = createInitialMatchState(1700000002)
  const app = {
    globalData: {
      matchState: createInitialMatchState(1700000003),
      matchHistory: {
        clearCalls: 0,
        clear() {
          this.clearCalls += 1
        }
      }
    }
  }

  const removedKeys = []
  const clearedMatchStorageKeys = []
  let navigationPayload = null

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }
  globalThis.hmApp = {
    gotoPage(payload) {
      navigationPayload = payload
    }
  }
  globalThis.getApp = () => app
  globalThis.settingsStorage = {
    getItem() {
      return JSON.stringify(savedState)
    },
    removeItem(key) {
      removedKeys.push(key)
    }
  }
  matchStorage.adapter = {
    async save() {},
    async load() {
      return null
    },
    async clear(key) {
      clearedMatchStorageKeys.push(key)
    }
  }

  let startButton = null

  try {
    const definition = await loadHomePageDefinition()
    const page = createPageInstance(definition)

    page.onInit()
    page.build()

    const visibleButtons = createdWidgets.filter(
      (widget) => widget.type === 'BUTTON' && !widget.deleted
    )

    startButton = visibleButtons.find(
      (widget) => widget.properties.text === 'home.startNewGame'
    )

    assert.ok(startButton)

    await startButton.properties.click_func()
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

  assert.deepEqual(removedKeys, [MATCH_STATE_STORAGE_KEY])
  assert.deepEqual(clearedMatchStorageKeys, [ACTIVE_MATCH_SESSION_STORAGE_KEY])
  assert.deepEqual(app.globalData.matchState, createInitialMatchState())
  assert.equal(app.globalData.matchHistory.clearCalls, 1)
  assert.deepEqual(navigationPayload, { url: 'page/setup' })
})

test('home screen shows Resume button and resumes without clearing persisted state', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp
  const originalGetApp = globalThis.getApp
  const originalSettingsStorage = globalThis.settingsStorage

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const savedState = createInitialMatchState(1700000002)

  const app = {
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

  let removeItemCalls = 0
  let navigationPayload = null

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }
  globalThis.hmApp = {
    gotoPage(payload) {
      navigationPayload = payload
    }
  }
  globalThis.getApp = () => app
  globalThis.settingsStorage = {
    getItem() {
      return JSON.stringify(savedState)
    },
    removeItem() {
      removeItemCalls += 1
    }
  }

  let resumeButton = null

  try {
    const definition = await loadHomePageDefinition()
    const page = createPageInstance(definition)

    page.onInit()
    page.build()

    const visibleButtons = createdWidgets.filter(
      (widget) => widget.type === 'BUTTON' && !widget.deleted
    )
    const buttonLabels = visibleButtons.map((widget) => widget.properties.text)

    assert.deepEqual(buttonLabels, ['home.startNewGame', 'home.resumeGame'])

    resumeButton = visibleButtons.find(
      (widget) => widget.properties.text === 'home.resumeGame'
    )
    assert.ok(resumeButton)

    resumeButton.properties.click_func()
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
  }

  assert.equal(removeItemCalls, 0)
  assert.deepEqual(app.globalData.matchState, savedState)
  assert.equal(app.globalData.matchHistory.clearCalls, 1)
  assert.deepEqual(navigationPayload, { url: 'page/game' })
})
