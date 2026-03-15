import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { HISTORY_STORAGE_KEY } from '../utils/match-history-storage.js'
import { MATCH_HISTORY_SCHEMA_VERSION } from '../utils/match-history-types.js'
import { saveState } from '../utils/persistence.js'
import {
  createLocalStorageMock,
  withMockLocalStorage
} from './helpers/local-storage-mock.js'
import { toProjectFileUrl } from './helpers/project-paths.js'

let settingsPageImportCounter = 0
let gameSettingsPageImportCounter = 0
let historyDetailPageImportCounter = 0

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
        BUTTON: 'BUTTON',
        SCROLL_LIST: 'SCROLL_LIST',
        SLIDE_SWITCH: 'SLIDE_SWITCH'
      },
      align: {
        CENTER_H: 'CENTER_H',
        CENTER_V: 'CENTER_V'
      },
      prop: {
        UPDATE_DATA: 'UPDATE_DATA'
      },
      createWidget(type, properties) {
        const widget = {
          type,
          properties,
          deleted: false,
          setProperty(propKey, value) {
            if (
              propKey === 'UPDATE_DATA' &&
              value &&
              typeof value === 'object'
            ) {
              this.properties = {
                ...this.properties,
                ...value
              }
              return
            }

            this.properties[propKey] = value
          }
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

function getVisibleWidgets(createdWidgets, type) {
  return createdWidgets.filter(
    (widget) => widget.type === type && widget.deleted !== true
  )
}

function getVisibleScrollList(createdWidgets) {
  return getVisibleWidgets(createdWidgets, 'SCROLL_LIST')[0] ?? null
}

function findVisibleButtonByImageSrc(createdWidgets, imageSrc) {
  return getVisibleWidgets(createdWidgets, 'BUTTON').find(
    (widget) => widget.properties.normal_src === imageSrc
  )
}

function createHistoryEntry(overrides = {}) {
  return {
    id: 'match-1',
    completedAt: 1700000000000,
    localTime: {
      year: 2026,
      month: 3,
      day: 14,
      hour: 17,
      minute: 30
    },
    teamALabel: 'Team A',
    teamBLabel: 'Team B',
    setsWonTeamA: 2,
    setsWonTeamB: 1,
    setHistory: [
      {
        setNumber: 1,
        teamAGames: 6,
        teamBGames: 4
      }
    ],
    winnerTeam: 'teamA',
    schemaVersion: MATCH_HISTORY_SCHEMA_VERSION,
    ...overrides
  }
}

async function loadSettingsPageDefinition() {
  const sourceUrl = toProjectFileUrl('page/settings.js')
  const appFeedbackUrl = toProjectFileUrl('utils/app-feedback.js')
  const appDataClearUrl = toProjectFileUrl('utils/app-data-clear.js')
  const designTokensUrl = toProjectFileUrl('utils/design-tokens.js')
  const layoutEngineUrl = toProjectFileUrl('utils/layout-engine.js')
  const layoutPresetsUrl = toProjectFileUrl('utils/layout-presets.js')
  const platformAdaptersUrl = toProjectFileUrl('utils/platform-adapters.js')
  const screenUtilsUrl = toProjectFileUrl('utils/screen-utils.js')
  const uiComponentsUrl = toProjectFileUrl('utils/ui-components.js')
  const versionUrl = toProjectFileUrl('utils/version.js')

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace(
      "import { gettext } from 'i18n'\n",
      'const gettext = (key) => key\n'
    )
    .replace("from '../utils/app-feedback.js'", `from '${appFeedbackUrl.href}'`)
    .replace(
      "from '../utils/app-data-clear.js'",
      `from '${appDataClearUrl.href}'`
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
    .replace(
      "from '../utils/platform-adapters.js'",
      `from '${platformAdaptersUrl.href}'`
    )
    .replace("from '../utils/screen-utils.js'", `from '${screenUtilsUrl.href}'`)
    .replace(
      "from '../utils/ui-components.js'",
      `from '${uiComponentsUrl.href}'`
    )
    .replace("from '../utils/version.js'", `from '${versionUrl.href}'`)

  const moduleUrl =
    'data:text/javascript;charset=utf-8,' +
    encodeURIComponent(source) +
    `#settings-page-${Date.now()}-${settingsPageImportCounter}`

  settingsPageImportCounter += 1

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
    throw new Error('Page definition was not registered by page/settings.js.')
  }

  return capturedDefinition
}

async function loadGameSettingsPageDefinition() {
  const sourceUrl = toProjectFileUrl('page/game-settings.js')
  const designTokensUrl = toProjectFileUrl('utils/design-tokens.js')
  const hapticFeedbackSettingsUrl = toProjectFileUrl(
    'utils/haptic-feedback-settings.js'
  )
  const layoutEngineUrl = toProjectFileUrl('utils/layout-engine.js')
  const layoutPresetsUrl = toProjectFileUrl('utils/layout-presets.js')
  const platformAdaptersUrl = toProjectFileUrl('utils/platform-adapters.js')
  const screenUtilsUrl = toProjectFileUrl('utils/screen-utils.js')
  const uiComponentsUrl = toProjectFileUrl('utils/ui-components.js')

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace(
      "import { gettext } from 'i18n'\n",
      'const gettext = (key) => key\n'
    )
    .replace(
      "from '../utils/design-tokens.js'",
      `from '${designTokensUrl.href}'`
    )
    .replace(
      "from '../utils/haptic-feedback-settings.js'",
      `from '${hapticFeedbackSettingsUrl.href}'`
    )
    .replace(
      "from '../utils/layout-engine.js'",
      `from '${layoutEngineUrl.href}'`
    )
    .replace(
      "from '../utils/layout-presets.js'",
      `from '${layoutPresetsUrl.href}'`
    )
    .replace(
      "from '../utils/platform-adapters.js'",
      `from '${platformAdaptersUrl.href}'`
    )
    .replace("from '../utils/screen-utils.js'", `from '${screenUtilsUrl.href}'`)
    .replace(
      "from '../utils/ui-components.js'",
      `from '${uiComponentsUrl.href}'`
    )

  const moduleUrl =
    'data:text/javascript;charset=utf-8,' +
    encodeURIComponent(source) +
    `#game-settings-page-${Date.now()}-${gameSettingsPageImportCounter}`

  gameSettingsPageImportCounter += 1

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
    throw new Error(
      'Page definition was not registered by page/game-settings.js.'
    )
  }

  return capturedDefinition
}

async function loadHistoryDetailPageDefinition() {
  const sourceUrl = toProjectFileUrl('page/history-detail.js')
  const designTokensUrl = toProjectFileUrl('utils/design-tokens.js')
  const layoutEngineUrl = toProjectFileUrl('utils/layout-engine.js')
  const layoutPresetsUrl = toProjectFileUrl('utils/layout-presets.js')
  const matchHistoryStorageUrl = toProjectFileUrl(
    'utils/match-history-storage.js'
  )
  const platformAdaptersUrl = toProjectFileUrl('utils/platform-adapters.js')
  const screenUtilsUrl = toProjectFileUrl('utils/screen-utils.js')
  const uiComponentsUrl = toProjectFileUrl('utils/ui-components.js')
  const validationUrl = toProjectFileUrl('utils/validation.js')

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace(
      "import { gettext } from 'i18n'\n",
      'const gettext = (key) => key\n'
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
    .replace(
      "from '../utils/match-history-storage.js'",
      `from '${matchHistoryStorageUrl.href}'`
    )
    .replace(
      "from '../utils/platform-adapters.js'",
      `from '${platformAdaptersUrl.href}?history-detail=${historyDetailPageImportCounter}'`
    )
    .replace("from '../utils/screen-utils.js'", `from '${screenUtilsUrl.href}'`)
    .replace(
      "from '../utils/ui-components.js'",
      `from '${uiComponentsUrl.href}'`
    )
    .replace("from '../utils/validation.js'", `from '${validationUrl.href}'`)

  const moduleUrl =
    'data:text/javascript;charset=utf-8,' +
    encodeURIComponent(source) +
    `#history-detail-page-${Date.now()}-${historyDetailPageImportCounter}`

  historyDetailPageImportCounter += 1

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
    throw new Error(
      'Page definition was not registered by page/history-detail.js.'
    )
  }

  return capturedDefinition
}

test('settings list shows game settings row and keeps version last', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting

  const { hmUI, createdWidgets } = createHmUiRecorder()
  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }

  try {
    const definition = await loadSettingsPageDefinition()
    const page = { ...definition }

    page.onInit()
    page.build()

    const scrollList = getVisibleWidgets(createdWidgets, 'SCROLL_LIST')[0]

    assert.ok(scrollList)
    assert.equal(scrollList.properties.data_count, 4)
    assert.deepEqual(
      scrollList.properties.data_array.slice(0, 3).map((entry) => entry.label),
      [
        'settings.previousMatches',
        'settings.gameSettings',
        'settings.clearAppData'
      ]
    )
    assert.match(
      scrollList.properties.data_array[3].version,
      /^settings\.version \d+\.\d+\.\d+$/
    )
    assert.equal(getVisibleWidgets(createdWidgets, 'SLIDE_SWITCH').length, 0)
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
  }
})

test('settings game settings row navigates to dedicated page', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const navigationCalls = []

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

  try {
    const definition = await loadSettingsPageDefinition()
    const page = { ...definition }

    page.onInit()
    page.build()

    const scrollList = getVisibleWidgets(createdWidgets, 'SCROLL_LIST')[0]
    assert.equal(typeof scrollList?.properties.item_click_func, 'function')

    scrollList.properties.item_click_func(scrollList, 1)

    assert.deepEqual(navigationCalls, [
      { url: 'page/game-settings', params: {} }
    ])
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
  }
})

test('settings clear-data first tap enters confirmation mode', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting

  const { hmUI, createdWidgets } = createHmUiRecorder()

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }

  try {
    const definition = await loadSettingsPageDefinition()
    const page = { ...definition }

    page.onInit()
    page.build()

    const scrollList = getVisibleScrollList(createdWidgets)
    assert.ok(scrollList)

    scrollList.properties.item_click_func(scrollList, 2)

    assert.equal(page.clearConfirmMode, true)
    assert.equal(
      scrollList.properties.data_array[2].label,
      'settings.clearDataConfirm'
    )
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
  }
})

test('settings clear-data second tap queues feedback and navigates home', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp
  const originalGetApp = globalThis.getApp

  const { hmUI, createdWidgets, shownToasts } = createHmUiRecorder()
  const storageMock = createLocalStorageMock()
  const { storage } = storageMock
  const navigationCalls = []

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
  globalThis.getApp = () => ({
    globalData: {
      matchState: {},
      matchHistory: { clear() {} },
      _lastPersistedSchemaState: {}
    }
  })

  try {
    await withMockLocalStorage(storage, async () => {
      storage.setItem('review-follow-up', 'pending')

      const definition = await loadSettingsPageDefinition()
      const page = { ...definition }

      page.onInit()
      page.build()

      const scrollList = getVisibleScrollList(createdWidgets)
      assert.ok(scrollList)

      scrollList.properties.item_click_func(scrollList, 2)
      scrollList.properties.item_click_func(scrollList, 2)

      assert.equal(page.clearConfirmMode, false)
      assert.equal(
        scrollList.properties.data_array[2].label,
        'settings.clearAppData'
      )
      assert.deepEqual(navigationCalls, [{ url: 'page/index' }])
      assert.equal(shownToasts.length, 0)
      assert.equal(
        storageMock.snapshot()['padel-buddy.home-feedback-message-key'],
        '__padel_buddy_platform_adapters__:"settings.dataCleared"'
      )
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
  }
})

test('settings clear-data failure keeps user on settings and shows error toast', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp
  const originalGetApp = globalThis.getApp

  const { hmUI, createdWidgets, shownToasts } = createHmUiRecorder()
  const { storage } = createLocalStorageMock()
  const navigationCalls = []

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
  globalThis.getApp = () => {
    throw new Error('app unavailable')
  }

  try {
    await withMockLocalStorage(storage, async () => {
      globalThis.localStorage = {
        ...globalThis.localStorage,
        clear() {
          throw new Error('clear failed')
        }
      }

      if (globalThis.__zosStorage) {
        globalThis.__zosStorage = {
          ...globalThis.__zosStorage,
          clear() {
            throw new Error('clear failed')
          }
        }
      }

      const definition = await loadSettingsPageDefinition()
      const page = { ...definition }

      page.onInit()
      page.build()

      const scrollList = getVisibleScrollList(createdWidgets)
      assert.ok(scrollList)

      scrollList.properties.item_click_func(scrollList, 2)
      scrollList.properties.item_click_func(scrollList, 2)

      assert.equal(page.clearConfirmMode, false)
      assert.deepEqual(navigationCalls, [])
      assert.equal(shownToasts[0]?.text, 'settings.clearFailed')
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
  }
})

test('settings clear-data confirmation resets when another item is tapped', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const navigationCalls = []

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

  try {
    const definition = await loadSettingsPageDefinition()
    const page = { ...definition }

    page.onInit()
    page.build()

    const scrollList = getVisibleScrollList(createdWidgets)
    assert.ok(scrollList)

    scrollList.properties.item_click_func(scrollList, 2)
    scrollList.properties.item_click_func(scrollList, 0)

    assert.equal(page.clearConfirmMode, false)
    assert.equal(
      scrollList.properties.data_array[2].label,
      'settings.clearAppData'
    )
    assert.deepEqual(navigationCalls, [{ url: 'page/history' }])
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
  }
})

test('settings onDestroy clears pending clear-data confirmation state', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting

  const { hmUI, createdWidgets } = createHmUiRecorder()

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }

  try {
    const definition = await loadSettingsPageDefinition()
    const page = { ...definition }

    page.onInit()
    page.build()

    const scrollList = getVisibleScrollList(createdWidgets)
    assert.ok(scrollList)

    scrollList.properties.item_click_func(scrollList, 2)
    assert.equal(page.clearConfirmMode, true)

    page.onDestroy()

    assert.equal(page.clearConfirmMode, false)
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
  }
})

test('history detail first tap enters delete confirmation mode', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting

  const { hmUI, createdWidgets, shownToasts } = createHmUiRecorder()
  const { storage } = createLocalStorageMock()

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }

  try {
    await withMockLocalStorage(storage, async () => {
      saveState(HISTORY_STORAGE_KEY, {
        matches: [createHistoryEntry()],
        schemaVersion: MATCH_HISTORY_SCHEMA_VERSION
      })

      const definition = await loadHistoryDetailPageDefinition()
      const page = { ...definition }

      page.onInit({ id: 'match-1' })
      page.build()

      let deleteButton = findVisibleButtonByImageSrc(
        createdWidgets,
        'delete-icon.png'
      )
      assert.ok(deleteButton)

      deleteButton.properties.click_func()

      deleteButton = findVisibleButtonByImageSrc(
        createdWidgets,
        'remove-icon.png'
      )

      assert.equal(page.deleteConfirmMode, true)
      assert.ok(deleteButton)
      assert.equal(shownToasts[0]?.text, 'history.deleteConfirmToast')
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
  }
})

test('history detail second tap deletes match and navigates back on success', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const { storage } = createLocalStorageMock()
  const goBackCalls = []

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }
  globalThis.hmApp = {
    goBack() {
      goBackCalls.push(true)
    }
  }

  try {
    await withMockLocalStorage(storage, async () => {
      saveState(HISTORY_STORAGE_KEY, {
        matches: [createHistoryEntry()],
        schemaVersion: MATCH_HISTORY_SCHEMA_VERSION
      })

      const definition = await loadHistoryDetailPageDefinition()
      const page = { ...definition }

      page.onInit({ id: 'match-1' })
      page.build()

      let deleteButton = findVisibleButtonByImageSrc(
        createdWidgets,
        'delete-icon.png'
      )
      deleteButton.properties.click_func()

      deleteButton = findVisibleButtonByImageSrc(
        createdWidgets,
        'remove-icon.png'
      )
      deleteButton.properties.click_func()

      assert.equal(page.deleteConfirmMode, false)
      assert.deepEqual(goBackCalls, [true])
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
  }
})

test('history detail delete failure resets confirmation state and icon', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const { storage } = createLocalStorageMock()
  const goBackCalls = []

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }
  globalThis.hmApp = {
    goBack() {
      goBackCalls.push(true)
    }
  }

  try {
    await withMockLocalStorage(storage, async () => {
      saveState(HISTORY_STORAGE_KEY, {
        matches: [createHistoryEntry()],
        schemaVersion: MATCH_HISTORY_SCHEMA_VERSION
      })

      const definition = await loadHistoryDetailPageDefinition()
      const page = { ...definition }

      page.onInit({ id: 'match-1' })
      page.build()
      page.matchEntry = createHistoryEntry({ id: 'missing-id' })

      let deleteButton = findVisibleButtonByImageSrc(
        createdWidgets,
        'delete-icon.png'
      )
      deleteButton.properties.click_func()

      deleteButton = findVisibleButtonByImageSrc(
        createdWidgets,
        'remove-icon.png'
      )
      deleteButton.properties.click_func()

      deleteButton = findVisibleButtonByImageSrc(
        createdWidgets,
        'delete-icon.png'
      )

      assert.equal(page.deleteConfirmMode, false)
      assert.ok(deleteButton)
      assert.deepEqual(goBackCalls, [])
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
  }
})

test('history detail onDestroy clears pending delete confirmation state', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const { storage } = createLocalStorageMock()

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }

  try {
    await withMockLocalStorage(storage, async () => {
      saveState(HISTORY_STORAGE_KEY, {
        matches: [createHistoryEntry()],
        schemaVersion: MATCH_HISTORY_SCHEMA_VERSION
      })

      const definition = await loadHistoryDetailPageDefinition()
      const page = { ...definition }

      page.onInit({ id: 'match-1' })
      page.build()

      const deleteButton = findVisibleButtonByImageSrc(
        createdWidgets,
        'delete-icon.png'
      )
      deleteButton.properties.click_func()

      assert.equal(page.deleteConfirmMode, true)

      page.onDestroy()

      assert.equal(page.deleteConfirmMode, false)
      assert.equal(page.deleteButton, null)
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
  }
})

test('game settings page renders vibration setting switch enabled by default', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const { hmUI, createdWidgets } = createHmUiRecorder()
  const { storage } = createLocalStorageMock()

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }

  try {
    await withMockLocalStorage(storage, async () => {
      const definition = await loadGameSettingsPageDefinition()
      const page = { ...definition }

      page.onInit()
      page.build()

      const visibleTexts = getVisibleWidgets(createdWidgets, 'TEXT').map(
        (widget) => widget.properties.text
      )
      const slideSwitch = getVisibleWidgets(createdWidgets, 'SLIDE_SWITCH')[0]

      assert.equal(visibleTexts.includes('gameSettings.title'), true)
      assert.equal(visibleTexts.includes('settings.vibrationFeedback'), true)
      assert.ok(slideSwitch)
      assert.equal(slideSwitch.properties.checked, true)
      assert.equal(slideSwitch.properties.select_bg, 'switch_on.png')
      assert.equal(slideSwitch.properties.un_select_bg, 'switch_off.png')
      assert.equal(slideSwitch.properties.slide_src, 'switch_thumb.png')
      assert.equal(typeof slideSwitch.properties.slide_select_x, 'number')
      assert.equal(typeof slideSwitch.properties.slide_un_select_x, 'number')
      assert.equal(slideSwitch.properties.slide_un_select_x, 0)
      assert.equal(slideSwitch.properties.slide_select_x > 0, true)
      assert.equal(
        typeof slideSwitch.properties.checked_change_func,
        'function'
      )
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
  }
})

test('game settings switch persists vibration preference across reload', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const { storage } = createLocalStorageMock()

  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }

  try {
    await withMockLocalStorage(storage, async () => {
      const definition = await loadGameSettingsPageDefinition()

      const firstRender = createHmUiRecorder()
      globalThis.hmUI = firstRender.hmUI

      const firstPage = { ...definition }
      firstPage.onInit()
      firstPage.build()

      const firstSwitch = getVisibleWidgets(
        firstRender.createdWidgets,
        'SLIDE_SWITCH'
      )[0]
      assert.ok(firstSwitch)

      firstSwitch.properties.checked_change_func(firstSwitch, false)

      const secondRender = createHmUiRecorder()
      globalThis.hmUI = secondRender.hmUI

      const secondPage = { ...definition }
      secondPage.onInit()
      secondPage.build()

      const secondSwitch = getVisibleWidgets(
        secondRender.createdWidgets,
        'SLIDE_SWITCH'
      )[0]
      assert.ok(secondSwitch)
      assert.equal(secondSwitch.properties.checked, false)
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
  }
})

test('app routes register game settings page for the target', async () => {
  const appConfigPath = toProjectFileUrl('app.json')
  const appConfig = JSON.parse(await readFile(appConfigPath, 'utf8'))

  assert.equal(
    appConfig.targets.gt.module.page.pages.includes('page/game-settings'),
    true
  )
})
