import assert from 'node:assert/strict'
import test from 'node:test'

import { createHistoryStack } from '../utils/history-stack.js'
import {
  ACTIVE_MATCH_SESSION_STORAGE_KEY,
  ZeppOsStorageAdapter,
  matchStorage
} from '../utils/match-storage.js'
import { createInitialMatchState } from '../utils/match-state.js'
import {
  clearActiveMatchSession,
  resetMatchStateManager,
  startNewMatchFlow
} from '../utils/start-new-match-flow.js'
import { MATCH_STATE_STORAGE_KEY } from '../utils/storage.js'

test('clearActiveMatchSession clears schema and legacy keys through persistence APIs', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  const store = new Map()

  globalThis.settingsStorage = {
    setItem(key, value) {
      store.set(key, value)
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    removeItem(key) {
      store.delete(key)
    }
  }

  store.set(ACTIVE_MATCH_SESSION_STORAGE_KEY, '{"status":"active"}')
  store.set(MATCH_STATE_STORAGE_KEY, '{"status":"active"}')

  try {
    const result = await clearActiveMatchSession()

    assert.deepEqual(result, {
      clearedSchema: true,
      clearedLegacy: true
    })
    assert.equal(store.has(ACTIVE_MATCH_SESSION_STORAGE_KEY), false)
    assert.equal(store.has(MATCH_STATE_STORAGE_KEY), false)
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }
})

test('clearActiveMatchSession is idempotent when keys are already absent', async () => {
  const resultFirstCall = await clearActiveMatchSession({
    async clearSchemaSession() {},
    clearLegacySession() {}
  })
  const resultSecondCall = await clearActiveMatchSession({
    async clearSchemaSession() {},
    clearLegacySession() {}
  })

  assert.deepEqual(resultFirstCall, {
    clearedSchema: true,
    clearedLegacy: true
  })
  assert.deepEqual(resultSecondCall, {
    clearedSchema: true,
    clearedLegacy: true
  })
})

test('clearActiveMatchSession reports partial success when schema clear fails', async () => {
  const result = await clearActiveMatchSession({
    async clearSchemaSession() {
      throw new Error('schema clear failed')
    },
    async clearLegacySession() {}
  })

  assert.deepEqual(result, {
    clearedSchema: false,
    clearedLegacy: true
  })
})

test('clearActiveMatchSession reports partial success when legacy clear fails', async () => {
  const result = await clearActiveMatchSession({
    async clearSchemaSession() {},
    clearLegacySession() {
      throw new Error('legacy clear failed')
    }
  })

  assert.deepEqual(result, {
    clearedSchema: true,
    clearedLegacy: false
  })
})

test('resetMatchStateManager resets runtime match state and clears existing history', () => {
  const app = {
    globalData: {
      matchState: {
        ...createInitialMatchState(1700000001),
        status: 'finished',
        winnerTeam: 'teamA',
        setHistory: [
          {
            setNumber: 1,
            teamAGames: 6,
            teamBGames: 3
          }
        ]
      },
      matchHistory: {
        clearCalls: 0,
        clear() {
          this.clearCalls += 1
        }
      }
    }
  }

  const result = resetMatchStateManager({
    getAppInstance() {
      return app
    }
  })

  assert.deepEqual(result, {
    didReset: true,
    resetMatchState: true,
    clearedMatchHistory: true,
    rehydratedMatchHistory: false
  })
  assert.deepEqual(app.globalData.matchState, createInitialMatchState())
  assert.equal(app.globalData.matchHistory.clearCalls, 1)
})

test('resetMatchStateManager rehydrates history stack when clear is unavailable', () => {
  const app = {
    globalData: {
      matchState: {
        ...createInitialMatchState(1700000002),
        status: 'finished'
      },
      matchHistory: null
    }
  }
  const rehydratedHistory = createHistoryStack()
  let createHistoryCalls = 0

  const result = resetMatchStateManager({
    getAppInstance() {
      return app
    },
    createInitialState() {
      return createInitialMatchState(1700000003)
    },
    createHistory() {
      createHistoryCalls += 1
      return rehydratedHistory
    }
  })

  assert.deepEqual(result, {
    didReset: true,
    resetMatchState: true,
    clearedMatchHistory: false,
    rehydratedMatchHistory: true
  })
  assert.deepEqual(app.globalData.matchState, createInitialMatchState(1700000003))
  assert.equal(app.globalData.matchHistory, rehydratedHistory)
  assert.equal(createHistoryCalls, 1)
})

test('resetMatchStateManager returns no-op result when app instance is unavailable', () => {
  const result = resetMatchStateManager({
    getAppInstance() {
      return null
    }
  })

  assert.deepEqual(result, {
    didReset: false,
    resetMatchState: false,
    clearedMatchHistory: false,
    rehydratedMatchHistory: false
  })
})

test('startNewMatchFlow clears storage, resets runtime manager, and navigates to setup', async () => {
  const originalSettingsStorage = globalThis.settingsStorage
  const originalGetApp = globalThis.getApp
  const originalHmApp = globalThis.hmApp
  const originalMatchStorageAdapter = matchStorage.adapter

  const store = new Map()
  const navigationCalls = []
  const app = {
    globalData: {
      matchState: {
        ...createInitialMatchState(1700000010),
        status: 'finished',
        winnerTeam: 'teamA'
      },
      matchHistory: {
        clearCalls: 0,
        clear() {
          this.clearCalls += 1
        }
      }
    }
  }

  globalThis.settingsStorage = {
    setItem(key, value) {
      store.set(key, value)
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    removeItem(key) {
      store.delete(key)
    }
  }
  globalThis.getApp = () => app
  globalThis.hmApp = {
    gotoPage(payload) {
      navigationCalls.push(payload)
    }
  }
  matchStorage.adapter = new ZeppOsStorageAdapter(globalThis.settingsStorage)

  store.set(ACTIVE_MATCH_SESSION_STORAGE_KEY, '{"status":"active"}')
  store.set(MATCH_STATE_STORAGE_KEY, '{"status":"active"}')

  try {
    const result = await startNewMatchFlow()

    assert.deepEqual(result, {
      clearSession: {
        clearedSchema: true,
        clearedLegacy: true
      },
      resetStateManager: {
        didReset: true,
        resetMatchState: true,
        clearedMatchHistory: true,
        rehydratedMatchHistory: false
      },
      navigatedToSetup: true,
      didEncounterError: false
    })
    assert.equal(store.has(ACTIVE_MATCH_SESSION_STORAGE_KEY), false)
    assert.equal(store.has(MATCH_STATE_STORAGE_KEY), false)
    assert.deepEqual(app.globalData.matchState, createInitialMatchState())
    assert.equal(app.globalData.matchHistory.clearCalls, 1)
    assert.deepEqual(navigationCalls, [{ url: 'page/setup' }])
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }

    if (typeof originalGetApp === 'undefined') {
      delete globalThis.getApp
    } else {
      globalThis.getApp = originalGetApp
    }

    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }

    matchStorage.adapter = originalMatchStorageAdapter
  }
})

test('startNewMatchFlow keeps flow order and fails safe when cleanup throws', async () => {
  const callOrder = []

  const result = await startNewMatchFlow({
    async clearSession() {
      callOrder.push('clear')
      throw new Error('clear failed')
    },
    resetStateManager() {
      callOrder.push('reset')
      return {
        didReset: true,
        resetMatchState: true,
        clearedMatchHistory: true,
        rehydratedMatchHistory: false
      }
    },
    navigateToSetup() {
      callOrder.push('navigate')
      return true
    }
  })

  assert.deepEqual(callOrder, ['clear', 'reset', 'navigate'])
  assert.deepEqual(result, {
    clearSession: {
      clearedSchema: false,
      clearedLegacy: false
    },
    resetStateManager: {
      didReset: true,
      resetMatchState: true,
      clearedMatchHistory: true,
      rehydratedMatchHistory: false
    },
    navigatedToSetup: true,
    didEncounterError: true
  })
})

test('startNewMatchFlow fails safe when navigation throws', async () => {
  const result = await startNewMatchFlow({
    async clearSession() {
      return {
        clearedSchema: true,
        clearedLegacy: true
      }
    },
    resetStateManager() {
      return {
        didReset: true,
        resetMatchState: true,
        clearedMatchHistory: false,
        rehydratedMatchHistory: true
      }
    },
    navigateToSetup() {
      throw new Error('navigation failed')
    }
  })

  assert.deepEqual(result, {
    clearSession: {
      clearedSchema: true,
      clearedLegacy: true
    },
    resetStateManager: {
      didReset: true,
      resetMatchState: true,
      clearedMatchHistory: false,
      rehydratedMatchHistory: true
    },
    navigatedToSetup: false,
    didEncounterError: true
  })
})
