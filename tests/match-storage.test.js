import assert from 'node:assert/strict'
import test from 'node:test'
import { getActiveSession } from '../utils/active-session-storage.js'
import {
  createDefaultMatchState,
  STORAGE_KEY,
  serializeMatchState
} from '../utils/match-state-schema.js'
import {
  ACTIVE_MATCH_SESSION_STORAGE_KEY,
  clearMatchState as clearStoredMatchState,
  MatchStorage,
  matchStorage,
  ZeppOsStorageAdapter
} from '../utils/match-storage.js'
import { createHmFsMock } from './helpers/hmfs-mock.js'

test('persistence module exports canonical storage key and initialized service', () => {
  assert.equal(ACTIVE_MATCH_SESSION_STORAGE_KEY, STORAGE_KEY)
  assert.ok(matchStorage instanceof MatchStorage)
})

test('ZeppOsStorageAdapter persists, loads, and clears values through settingsStorage methods', () => {
  const store = new Map()
  const storage = {
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
  const adapter = new ZeppOsStorageAdapter()
  adapter.storage = storage

  adapter.save(STORAGE_KEY, 'payload')
  assert.equal(adapter.load(STORAGE_KEY), 'payload')

  adapter.clear(STORAGE_KEY)
  assert.equal(adapter.load(STORAGE_KEY), null)
})

test('ZeppOsStorageAdapter clear falls back to setItem when removeItem is unavailable', () => {
  const removeCalls = []
  const storage = {
    removeItem(key) {
      removeCalls.push(key)
      throw new Error('removeItem not available')
    }
  }
  const adapter = new ZeppOsStorageAdapter()
  adapter.storage = storage

  adapter.clear(STORAGE_KEY)

  assert.deepEqual(removeCalls, [STORAGE_KEY])
})

test('ZeppOsStorageAdapter converts non-string load values to strings', () => {
  const adapter = new ZeppOsStorageAdapter()
  adapter.storage = {
    getItem() {
      return 12345
    }
  }

  assert.equal(adapter.load(STORAGE_KEY), 12345)
})

test('ZeppOsStorageAdapter load returns null when storage returns undefined', () => {
  const adapter = new ZeppOsStorageAdapter()
  adapter.storage = {
    getItem() {
      return null
    }
  }

  assert.equal(adapter.load(STORAGE_KEY), null)
})

test('ZeppOsStorageAdapter gracefully handles save/load/clear runtime errors', () => {
  const adapter = new ZeppOsStorageAdapter()
  adapter.storage = {
    setItem() {
      throw new Error('write failed')
    },
    getItem() {
      throw new Error('read failed')
    },
    removeItem() {
      throw new Error('delete failed')
    }
  }

  assert.doesNotThrow(() => {
    adapter.save(STORAGE_KEY, 'payload')
  })
  assert.equal(adapter.load(STORAGE_KEY), null)
  assert.doesNotThrow(() => {
    adapter.clear(STORAGE_KEY)
  })
})

test('MatchStorage save/load/clear round-trip uses schema storage key', async () => {
  const store = new Map()
  const calls = []
  const adapter = {
    save(key, value) {
      calls.push({ method: 'save', key })
      store.set(key, value)
    },
    load(key) {
      calls.push({ method: 'load', key })
      return store.has(key) ? store.get(key) : null
    },
    clear(key) {
      calls.push({ method: 'clear', key })
      store.delete(key)
    }
  }
  const matchStorage = new MatchStorage(adapter)
  const state = createDefaultMatchState()

  matchStorage.saveMatchState(state)
  const loadedState = matchStorage.loadMatchState()
  matchStorage.clearMatchState()
  const loadedAfterClear = matchStorage.loadMatchState()

  assert.equal(calls[0].method, 'save')
  assert.equal(calls[0].key, STORAGE_KEY)
  assert.equal(calls[1].method, 'load')
  assert.equal(calls[1].key, STORAGE_KEY)
  assert.equal(calls[2].method, 'clear')
  assert.equal(calls[2].key, STORAGE_KEY)
  assert.equal(calls[3].method, 'load')
  assert.equal(calls[3].key, STORAGE_KEY)
  assert.deepEqual(loadedState, state)
  assert.equal(loadedAfterClear, null)
})

test('MatchStorage saveMatchState refreshes updatedAt and persists serialized state', async () => {
  const calls = []
  const adapter = {
    save(key, value) {
      calls.push({ key, value })
    },
    load() {
      return null
    },
    clear() {}
  }
  const matchStorage = new MatchStorage(adapter)
  const state = createDefaultMatchState()
  const fixedTimestamp = 1700000000123
  const originalDateNow = Date.now
  state.updatedAt = 0

  Date.now = () => fixedTimestamp

  try {
    matchStorage.saveMatchState(state)
  } finally {
    Date.now = originalDateNow
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].key, STORAGE_KEY)
  assert.equal(state.updatedAt, fixedTimestamp)
  assert.equal(calls[0].value, serializeMatchState(state))
})

test('MatchStorage saveMatchState normalizes timing fields via canonical serializer', () => {
  const calls = []
  const adapter = {
    save(key, value) {
      calls.push({ key, value })
    },
    load() {
      return null
    },
    clear() {}
  }
  const storage = new MatchStorage(adapter)
  const state = createDefaultMatchState()
  const fixedTimestamp = 1700000000500
  const originalDateNow = Date.now

  state.timing.startedAt = null

  Date.now = () => fixedTimestamp

  try {
    storage.saveMatchState(state)
  } finally {
    Date.now = originalDateNow
  }

  assert.equal(calls.length, 1)
  assert.equal(state.timing.startedAt, state.timing.createdAt)
  assert.equal(Date.parse(state.timing.updatedAt), state.updatedAt)
  assert.equal(state.updatedAt, fixedTimestamp)
})

test('MatchStorage ignores invalid state payloads on save', async () => {
  const calls = []
  const adapter = {
    save(key, value) {
      calls.push({ key, value })
    },
    load() {
      return null
    },
    clear() {}
  }
  const matchStorage = new MatchStorage(adapter)

  matchStorage.saveMatchState({ status: 'active' })

  assert.deepEqual(calls, [])
})

test('MatchStorage returns null when adapter payload is missing', async () => {
  const payloads = [null, undefined, '']
  const adapter = {
    save() {},
    load() {
      return payloads.shift() ?? null
    },
    clear() {}
  }
  const matchStorage = new MatchStorage(adapter)

  assert.equal(matchStorage.loadMatchState(), null)
  assert.equal(matchStorage.loadMatchState(), null)
  assert.equal(matchStorage.loadMatchState(), null)
})

test('MatchStorage loads valid serialized payloads', async () => {
  const state = createDefaultMatchState()
  const matchStorage = new MatchStorage({
    save() {},
    load() {
      return serializeMatchState(state)
    },
    clear() {}
  })

  assert.deepEqual(matchStorage.loadMatchState(), state)
})

test('MatchStorage returns null when adapter payload is corrupted JSON', async () => {
  const matchStorage = new MatchStorage({
    save() {},
    load() {
      return '{bad-json'
    },
    clear() {}
  })

  assert.equal(matchStorage.loadMatchState(), null)
})

test('MatchStorage returns null when adapter payload is malformed JSON shape', async () => {
  const state = createDefaultMatchState()
  const malformedPayload = JSON.stringify({
    status: state.status,
    setsToPlay: state.setsToPlay,
    setsNeededToWin: state.setsNeededToWin
  })
  const matchStorage = new MatchStorage({
    save() {},
    load() {
      return malformedPayload
    },
    clear() {}
  })

  assert.equal(matchStorage.loadMatchState(), null)
})

test('MatchStorage returns null when adapter payload contains invalid match fields', async () => {
  const state = createDefaultMatchState()
  const invalidPayload = JSON.stringify({
    ...state,
    currentSet: {
      ...state.currentSet,
      number: '1'
    }
  })
  const matchStorage = new MatchStorage({
    save() {},
    load() {
      return invalidPayload
    },
    clear() {}
  })

  assert.equal(matchStorage.loadMatchState(), null)
})

test('MatchStorage supports sequential save-load cycles with latest state wins', async () => {
  const store = new Map()
  const matchStorage = new MatchStorage({
    save(key, value) {
      store.set(key, value)
    },
    load(key) {
      return store.has(key) ? store.get(key) : null
    },
    clear(key) {
      store.delete(key)
    }
  })

  const firstState = createDefaultMatchState()
  const secondState = createDefaultMatchState()
  secondState.currentSet.games.teamA = 2

  const saveTimestamps = [1700000001000, 1700000002000]
  const originalDateNow = Date.now

  Date.now = () => saveTimestamps.shift() ?? 1700000002000

  try {
    matchStorage.saveMatchState(firstState)
    assert.deepEqual(matchStorage.loadMatchState(), firstState)

    matchStorage.saveMatchState(secondState)
    assert.deepEqual(matchStorage.loadMatchState(), secondState)
  } finally {
    Date.now = originalDateNow
  }
})

test('MatchStorage saveMatchState keeps updatedAt deterministic with canonical persistence', () => {
  const { mock } = createHmFsMock()
  const originalHmFS = globalThis.hmFS
  const originalDateNow = Date.now
  const dateNowValues = [1700000003000, 1700000004000]
  const state = createDefaultMatchState()
  const storage = new MatchStorage()

  globalThis.hmFS = mock
  Date.now = () => dateNowValues.shift() ?? 1700000004000

  try {
    storage.saveMatchState(state)
    const persistedState = getActiveSession()

    assert.notEqual(persistedState, null)
    assert.equal(state.updatedAt, 1700000003000)
    assert.equal(persistedState?.updatedAt, 1700000003000)
  } finally {
    Date.now = originalDateNow

    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
})

test('MatchStorage saveMatchState preserves persisted startedAt on subsequent saves', () => {
  const { mock } = createHmFsMock()
  const originalHmFS = globalThis.hmFS
  const originalDateNow = Date.now
  const dateNowValues = [1700000005000, 1700000006000]
  const state = createDefaultMatchState()
  const storage = new MatchStorage()

  globalThis.hmFS = mock
  Date.now = () => dateNowValues.shift() ?? 1700000006000

  try {
    storage.saveMatchState(state)
    const firstPersisted = getActiveSession()
    assert.notEqual(firstPersisted, null)

    state.timing.startedAt = '2040-01-01T00:00:00.000Z'
    storage.saveMatchState(state)

    const secondPersisted = getActiveSession()
    assert.notEqual(secondPersisted, null)
    assert.equal(
      secondPersisted?.timing?.startedAt,
      firstPersisted?.timing?.startedAt
    )
  } finally {
    Date.now = originalDateNow

    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
})

test('MatchStorage loadMatchState never throws when adapter load fails', async () => {
  const matchStorage = new MatchStorage({
    save() {},
    load() {
      throw new Error('read failed')
    },
    clear() {}
  })

  assert.doesNotThrow(() => {
    assert.equal(matchStorage.loadMatchState(), null)
  })
})

test('MatchStorage clearMatchState never throws when adapter clear fails', async () => {
  const matchStorage = new MatchStorage({
    save() {},
    load() {
      return null
    },
    clear() {
      throw new Error('delete failed')
    }
  })

  assert.doesNotThrow(() => {
    matchStorage.clearMatchState()
  })
})

test('clearMatchState utility clears stored payload and is safe when storage is already empty', async () => {
  const store = new Map()
  const originalAdapter = matchStorage.adapter

  matchStorage.adapter = {
    save(key, value) {
      store.set(key, value)
    },
    load(key) {
      return store.has(key) ? store.get(key) : null
    },
    clear(key) {
      store.delete(key)
    }
  }

  try {
    matchStorage.saveMatchState(createDefaultMatchState())
    assert.equal(store.has(STORAGE_KEY), true)

    clearStoredMatchState()
    assert.equal(store.has(STORAGE_KEY), false)

    assert.doesNotThrow(() => {
      clearStoredMatchState()
    })
  } finally {
    matchStorage.adapter = originalAdapter
  }
})
