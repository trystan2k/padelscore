import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createHmFsMock } from './helpers/hmfs-mock.js'
import { toProjectFileUrl } from './helpers/project-paths.js'

let settingsPageImportCounter = 0
let gameSettingsPageImportCounter = 0

function createHmUiRecorder() {
  const createdWidgets = []

  return {
    createdWidgets,
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
      }
    }
  }
}

function getVisibleWidgets(createdWidgets, type) {
  return createdWidgets.filter(
    (widget) => widget.type === type && widget.deleted !== true
  )
}

async function loadSettingsPageDefinition() {
  const sourceUrl = toProjectFileUrl('page/settings.js')
  const appDataClearUrl = toProjectFileUrl('utils/app-data-clear.js')
  const designTokensUrl = toProjectFileUrl('utils/design-tokens.js')
  const layoutEngineUrl = toProjectFileUrl('utils/layout-engine.js')
  const layoutPresetsUrl = toProjectFileUrl('utils/layout-presets.js')
  const screenUtilsUrl = toProjectFileUrl('utils/screen-utils.js')
  const uiComponentsUrl = toProjectFileUrl('utils/ui-components.js')
  const versionUrl = toProjectFileUrl('utils/version.js')

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace(
      "import { gettext } from 'i18n'\n",
      'const gettext = (key) => key\n'
    )
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

    assert.deepEqual(navigationCalls, [{ url: 'page/game-settings' }])
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

test('game settings page renders vibration setting switch enabled by default', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmFS = globalThis.hmFS

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const hmFsMock = createHmFsMock()

  globalThis.hmUI = hmUI
  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }
  globalThis.hmFS = hmFsMock.mock

  try {
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
    assert.equal(typeof slideSwitch.properties.checked_change_func, 'function')
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

    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
})

test('game settings switch persists vibration preference across reload', async () => {
  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmFS = globalThis.hmFS

  const hmFsMock = createHmFsMock()

  globalThis.hmSetting = {
    getDeviceInfo() {
      return { width: 390, height: 450 }
    }
  }
  globalThis.hmFS = hmFsMock.mock

  try {
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

    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
})

test('app routes register game settings page for the target', async () => {
  const appConfigPath = toProjectFileUrl('app.json')
  const appConfig = JSON.parse(await readFile(appConfigPath, 'utf8'))

  assert.equal(
    appConfig.targets['gt'].module.page.pages.includes('page/game-settings'),
    true
  )
})
