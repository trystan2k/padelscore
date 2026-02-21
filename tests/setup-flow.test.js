import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { MATCH_STATUS, STORAGE_KEY } from '../utils/match-state-schema.js'
import { matchStorage } from '../utils/match-storage.js'

let setupPageImportCounter = 0

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

async function loadSetupPageDefinition() {
  const sourceUrl = new URL('../page/setup.js', import.meta.url)
  const matchSessionInitUrl = new URL('../utils/match-session-init.js', import.meta.url)
  const matchStorageUrl = new URL('../utils/match-storage.js', import.meta.url)
  const matchStateSchemaUrl = new URL('../utils/match-state-schema.js', import.meta.url)

  let source = await readFile(sourceUrl, 'utf8')

  source = source
    .replace("import { gettext } from 'i18n'\n", 'const gettext = (key) => key\n')
    .replace("from '../utils/match-session-init.js'", `from '${matchSessionInitUrl.href}'`)
    .replace("from '../utils/match-storage.js'", `from '${matchStorageUrl.href}'`)
    .replace("from '../utils/match-state-schema.js'", `from '${matchStateSchemaUrl.href}'`)

  const moduleUrl =
    'data:text/javascript;charset=utf-8,' +
    encodeURIComponent(source) +
    `#setup-flow-${Date.now()}-${setupPageImportCounter}`

  setupPageImportCounter += 1

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
    throw new Error('Page definition was not registered by page/setup.js.')
  }

  return capturedDefinition
}

function getVisibleWidgets(createdWidgets, type) {
  return createdWidgets.filter((widget) => widget.type === type && !widget.deleted)
}

function findButtonByText(buttons, text) {
  return buttons.find((button) => button.properties.text === text)
}

function createMockStorageAdapter(options = {}) {
  const {
    saveFails = false,
    initialData = null,
    onSave = null,
    onLoad = null,
    loadOverride
  } = options
  const store = new Map()

  if (initialData !== null) {
    store.set(STORAGE_KEY, initialData)
  }

  const savedPayloads = []

  return {
    store,
    savedPayloads,
    async save(key, value) {
      if (saveFails) {
        throw new Error('Save failed')
      }
      savedPayloads.push({ key, value })
      store.set(key, value)

      if (typeof onSave === 'function') {
        onSave(key, value)
      }
    },
    async load(key) {
      if (typeof onLoad === 'function') {
        onLoad(key)
      }

      if (typeof loadOverride === 'function') {
        return loadOverride(key, store)
      }

      if (typeof loadOverride !== 'undefined') {
        return loadOverride
      }

      return store.has(key) ? store.get(key) : null
    },
    async clear(key) {
      store.delete(key)
    }
  }
}

async function runWithSetupPage(options = {}, runScenario) {
  const {
    saveFails = false,
    navigationFails = false,
    onSave = null,
    onLoad = null,
    onNavigate = null,
    loadOverride
  } = options

  const originalHmUI = globalThis.hmUI
  const originalHmSetting = globalThis.hmSetting
  const originalHmApp = globalThis.hmApp
  const originalAdapter = matchStorage.adapter

  const { hmUI, createdWidgets } = createHmUiRecorder()
  const mockAdapter = createMockStorageAdapter({
    saveFails,
    onSave,
    onLoad,
    loadOverride
  })
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

      if (typeof onNavigate === 'function') {
        onNavigate(payload)
      }

      if (navigationFails) {
        throw new Error('Navigation failed')
      }
    }
  }

  matchStorage.adapter = mockAdapter

  try {
    const definition = await loadSetupPageDefinition()
    const page = createPageInstance(definition)

    return await runScenario({
      page,
      createdWidgets,
      mockAdapter,
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

    matchStorage.adapter = originalAdapter
  }
}

test('setup page renders three set selection buttons and disabled start button', async () => {
  await runWithSetupPage({}, ({ page, createdWidgets }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const optionButtons = buttons.filter((button) =>
      button.properties.text.startsWith('setup.option.')
    )
    const startButton = findButtonByText(buttons, 'setup.startMatch')

    assert.equal(optionButtons.length, 3)
    assert.equal(Boolean(startButton), true)
    assert.equal(startButton.properties.normal_color, 0x2a2d34)
    assert.equal(startButton.properties.color, 0x7d8289)
  })
})

test('setup page set selection buttons have expected labels', async () => {
  await runWithSetupPage({}, ({ page, createdWidgets }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const optionLabels = buttons
      .filter((button) => button.properties.text.startsWith('setup.option.'))
      .map((button) => button.properties.text)

    assert.deepEqual(optionLabels, [
      'setup.option.oneSet',
      'setup.option.threeSets',
      'setup.option.fiveSets'
    ])
  })
})

test('setup page selection updates option button visual state', async () => {
  await runWithSetupPage({}, ({ page, createdWidgets }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const oneSetButton = findButtonByText(buttons, 'setup.option.oneSet')

    oneSetButton.properties.click_func()

    const updatedButtons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const updatedOneSetButton = findButtonByText(updatedButtons, 'setup.option.oneSet')

    assert.equal(updatedOneSetButton.properties.normal_color, 0x1eb98c)
    assert.equal(updatedOneSetButton.properties.color, 0x000000)
  })
})

test('setup page start button remains disabled without selection', async () => {
  await runWithSetupPage({}, ({ page, createdWidgets }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const startButton = findButtonByText(buttons, 'setup.startMatch')

    assert.equal(page.hasSetSelection(), false)
    assert.equal(page.isStartMatchEnabled(), false)
    assert.equal(startButton.properties.normal_color, 0x2a2d34)
  })
})

test('setup page start button enables after valid selection', async () => {
  await runWithSetupPage({}, ({ page, createdWidgets }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const threeSetsButton = findButtonByText(buttons, 'setup.option.threeSets')

    threeSetsButton.properties.click_func()

    const updatedButtons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const startButton = findButtonByText(updatedButtons, 'setup.startMatch')

    assert.equal(page.hasSetSelection(), true)
    assert.equal(page.selectedSetsToPlay, 3)
    assert.equal(startButton.properties.normal_color, 0x1eb98c)
    assert.equal(startButton.properties.color, 0x000000)
  })
})

test('setup page allows changing set selection before starting match', async () => {
  await runWithSetupPage({}, ({ page, createdWidgets }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const oneSetButton = findButtonByText(buttons, 'setup.option.oneSet')
    const fiveSetsButton = findButtonByText(buttons, 'setup.option.fiveSets')

    oneSetButton.properties.click_func()
    assert.equal(page.selectedSetsToPlay, 1)

    fiveSetsButton.properties.click_func()
    assert.equal(page.selectedSetsToPlay, 5)
  })
})

test('setup page start match initializes state with selected sets', async () => {
  await runWithSetupPage({}, async ({ page, createdWidgets, mockAdapter }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const threeSetsButton = findButtonByText(buttons, 'setup.option.threeSets')

    threeSetsButton.properties.click_func()

    const startMatchResult = await page.handleStartMatch()

    assert.equal(startMatchResult, true)
    assert.equal(mockAdapter.savedPayloads.length, 1)

    const savedState = JSON.parse(mockAdapter.savedPayloads[0].value)

    assert.equal(savedState.status, MATCH_STATUS.ACTIVE)
    assert.equal(savedState.setsToPlay, 3)
    assert.equal(savedState.setsNeededToWin, 2)
    assert.equal(savedState.currentSet.number, 1)
    assert.deepEqual(savedState.currentSet.games, { teamA: 0, teamB: 0 })
    assert.deepEqual(savedState.currentGame.points, { teamA: 0, teamB: 0 })
    assert.deepEqual(savedState.setsWon, { teamA: 0, teamB: 0 })
    assert.deepEqual(savedState.setHistory, [])
  })
})

test('setup page initializes state with correct setsNeededToWin for each option', async () => {
  const expectedConfigs = [
    { setsToPlay: 1, setsNeededToWin: 1, buttonLabel: 'setup.option.oneSet' },
    { setsToPlay: 3, setsNeededToWin: 2, buttonLabel: 'setup.option.threeSets' },
    { setsToPlay: 5, setsNeededToWin: 3, buttonLabel: 'setup.option.fiveSets' }
  ]

  for (const config of expectedConfigs) {
    await runWithSetupPage({}, async ({ page, createdWidgets, mockAdapter }) => {
      page.onInit()
      page.build()

      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const optionButton = findButtonByText(buttons, config.buttonLabel)

      optionButton.properties.click_func()
      await page.handleStartMatch()

      const savedState = JSON.parse(mockAdapter.savedPayloads[0].value)

      assert.equal(savedState.setsToPlay, config.setsToPlay)
      assert.equal(savedState.setsNeededToWin, config.setsNeededToWin)
    })
  }
})

test('setup page persists state before navigating to game', async () => {
  const eventOrder = []

  await runWithSetupPage(
    {
      onSave() {
        eventOrder.push('save')
      },
      onLoad() {
        eventOrder.push('load')
      },
      onNavigate() {
        eventOrder.push('navigate')
      }
    },
    async ({ page, createdWidgets, mockAdapter, navigationCalls }) => {
      page.onInit()
      page.build()

      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const oneSetButton = findButtonByText(buttons, 'setup.option.oneSet')

      oneSetButton.properties.click_func()

      eventOrder.push('before-start')
      const didStartMatch = await page.handleStartMatch()
      eventOrder.push('after-start')

      assert.equal(didStartMatch, true)
      assert.equal(mockAdapter.savedPayloads.length, 1)
      assert.equal(navigationCalls.length, 1)
    }
  )

  assert.deepEqual(eventOrder, ['before-start', 'save', 'load', 'navigate', 'after-start'])
})

test('setup page navigates to game after successful save', async () => {
  await runWithSetupPage({}, async ({ page, createdWidgets, navigationCalls }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const fiveSetsButton = findButtonByText(buttons, 'setup.option.fiveSets')

    fiveSetsButton.properties.click_func()

    const result = await page.handleStartMatch()

    assert.equal(result, true)
    assert.equal(navigationCalls.length, 1)
    assert.deepEqual(navigationCalls[0], { url: 'page/game' })
  })
})

test('setup page does not navigate when start button clicked without selection', async () => {
  await runWithSetupPage({}, async ({ page, navigationCalls }) => {
    page.onInit()

    const result = await page.handleStartMatch()

    assert.equal(result, false)
    assert.equal(navigationCalls.length, 0)
  })
})

test('setup page shows error and does not navigate when save fails', async () => {
  await runWithSetupPage({ saveFails: true }, async ({ page, createdWidgets, navigationCalls }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const threeSetsButton = findButtonByText(buttons, 'setup.option.threeSets')

    threeSetsButton.properties.click_func()

    const result = await page.handleStartMatch()

    assert.equal(result, false)
    assert.equal(navigationCalls.length, 0)
    assert.equal(page.startErrorMessage, 'setup.saveFailed')
  })
})

test('setup page does not navigate when persisted session verification fails', async () => {
  let loadCalls = 0

  await runWithSetupPage(
    {
      loadOverride() {
        loadCalls += 1
        return null
      }
    },
    async ({ page, createdWidgets, navigationCalls, mockAdapter }) => {
      page.onInit()
      page.build()

      const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
      const threeSetsButton = findButtonByText(buttons, 'setup.option.threeSets')

      threeSetsButton.properties.click_func()

      const didStartMatch = await page.handleStartMatch()

      assert.equal(didStartMatch, false)
      assert.equal(mockAdapter.savedPayloads.length, 1)
      assert.equal(navigationCalls.length, 0)
      assert.equal(page.startErrorMessage, 'setup.saveFailed')
      assert.equal(page.isPersistingMatchState, false)
    }
  )

  assert.equal(loadCalls >= 1, true)
})

test('setup page shows error when navigation fails after successful save', async () => {
  await runWithSetupPage({ navigationFails: true }, async ({ page, createdWidgets, navigationCalls, mockAdapter }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const oneSetButton = findButtonByText(buttons, 'setup.option.oneSet')

    oneSetButton.properties.click_func()

    const result = await page.handleStartMatch()

    assert.equal(result, false)
    assert.equal(mockAdapter.savedPayloads.length, 1)
    assert.equal(navigationCalls.length, 1)
    assert.equal(page.startErrorMessage, 'setup.saveFailed')
    assert.equal(page.isNavigatingToGame, false)
  })
})

test('setup page start button click handler returns early when disabled', async () => {
  await runWithSetupPage({}, async ({ page, mockAdapter, navigationCalls }) => {
    page.onInit()

    const result = await page.handleStartMatch()

    assert.equal(result, false)
    assert.equal(mockAdapter.savedPayloads.length, 0)
    assert.equal(navigationCalls.length, 0)
  })
})

test('setup page prevents duplicate start while persisting', async () => {
  await runWithSetupPage({}, async ({ page, createdWidgets }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const threeSetsButton = findButtonByText(buttons, 'setup.option.threeSets')

    threeSetsButton.properties.click_func()

    const startPromises = [
      page.handleStartMatch(),
      page.handleStartMatch(),
      page.handleStartMatch()
    ]

    const results = await Promise.all(startPromises)

    const successCount = results.filter((result) => result === true).length

    assert.equal(successCount, 1)
  })
})

test('setup page resets error message when user changes selection', async () => {
  await runWithSetupPage({ saveFails: true }, async ({ page, createdWidgets }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const oneSetButton = findButtonByText(buttons, 'setup.option.oneSet')
    const threeSetsButton = findButtonByText(buttons, 'setup.option.threeSets')

    oneSetButton.properties.click_func()
    await page.handleStartMatch()

    assert.equal(page.startErrorMessage, 'setup.saveFailed')

    threeSetsButton.properties.click_func()

    assert.equal(page.startErrorMessage, '')
  })
})

test('setup page clears error message on successful start after previous failure', async () => {
  let shouldSaveFail = true

  await runWithSetupPage({}, async ({ page, createdWidgets, mockAdapter, navigationCalls }) => {
    const failingAdapter = {
      async save() {
        if (shouldSaveFail) {
          throw new Error('Save failed')
        }
        return mockAdapter.save.apply(mockAdapter, arguments)
      },
      async load() {
        return mockAdapter.load.apply(mockAdapter, arguments)
      },
      async clear() {
        return mockAdapter.clear.apply(mockAdapter, arguments)
      }
    }

    matchStorage.adapter = failingAdapter

    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const threeSetsButton = findButtonByText(buttons, 'setup.option.threeSets')

    threeSetsButton.properties.click_func()

    const failResult = await page.handleStartMatch()

    assert.equal(failResult, false)
    assert.equal(page.startErrorMessage, 'setup.saveFailed')

    shouldSaveFail = false
    matchStorage.adapter = mockAdapter

    const successResult = await page.handleStartMatch()

    assert.equal(successResult, true)
    assert.equal(page.startErrorMessage, '')
    assert.equal(navigationCalls.length, 1)
  })
})

test('setup page invokes onStartMatch callback when provided', async () => {
  const callbackCalls = []

  await runWithSetupPage({}, async ({ page, createdWidgets }) => {
    page.onStartMatch = (setsToPlay, matchState) => {
      callbackCalls.push({ setsToPlay, matchState })
    }

    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const fiveSetsButton = findButtonByText(buttons, 'setup.option.fiveSets')

    fiveSetsButton.properties.click_func()

    await page.handleStartMatch()

    assert.equal(callbackCalls.length, 1)
    assert.equal(callbackCalls[0].setsToPlay, 5)
    assert.equal(callbackCalls[0].matchState.setsToPlay, 5)
    assert.equal(callbackCalls[0].matchState.status, MATCH_STATUS.ACTIVE)
  })
})

test('setup page renders error text widget when error message is set', async () => {
  await runWithSetupPage({ saveFails: true }, async ({ page, createdWidgets }) => {
    page.onInit()
    page.build()

    const buttons = getVisibleWidgets(createdWidgets, 'BUTTON')
    const oneSetButton = findButtonByText(buttons, 'setup.option.oneSet')

    oneSetButton.properties.click_func()
    await page.handleStartMatch()

    const errorTextWidgets = getVisibleWidgets(createdWidgets, 'TEXT').filter(
      (widget) => widget.properties.text === 'setup.saveFailed'
    )

    assert.equal(errorTextWidgets.length, 1)
    assert.equal(errorTextWidgets[0].properties.color, 0xff6d78)
  })
})

test('setup page does not render error text widget when no error', async () => {
  await runWithSetupPage({}, ({ page, createdWidgets }) => {
    page.onInit()
    page.build()

    const textWidgets = getVisibleWidgets(createdWidgets, 'TEXT')
    const errorTextWidgets = textWidgets.filter(
      (widget) => widget.properties.text === 'setup.saveFailed'
    )

    assert.equal(errorTextWidgets.length, 0)
  })
})
