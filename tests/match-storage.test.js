import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACTIVE_MATCH_SESSION_STORAGE_KEY,
  MatchStorage,
  ZeppOsStorageAdapter,
  clearMatchState as clearStoredMatchState,
  matchStorage
} from '../utils/match-storage.js'
import {
  STORAGE_KEY,
  createDefaultMatchState,
  serializeMatchState
} from '../utils/match-state-schema.js'

test('persistence module exports canonical storage key and initialized service', () => {
  assert.equal(ACTIVE_MATCH_SESSION_STORAGE_KEY, STORAGE_KEY)
  assert.ok(matchStorage instanceof MatchStorage)
})

test('ZeppOsStorageAdapter persists, loads, and clears values through settingsStorage methods', async () => {
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
  const adapter = new ZeppOsStorageAdapter(storage)

  await adapter.save(STORAGE_KEY, 'payload')
  assert.equal(await adapter.load(STORAGE_KEY), 'payload')

  await adapter.clear(STORAGE_KEY)
  assert.equal(await adapter.load(STORAGE_KEY), null)
})

test('ZeppOsStorageAdapter clear falls back to setItem when removeItem is unavailable', async () => {
  const writes = []
  const storage = {
    setItem(key, value) {
      writes.push({ key, value })
    }
  }
  const adapter = new ZeppOsStorageAdapter(storage)

  await adapter.clear(STORAGE_KEY)

  assert.deepEqual(writes, [
    {
      key: STORAGE_KEY,
      value: ''
    }
  ])
})

test('ZeppOsStorageAdapter converts non-string load values to strings', async () => {
  const adapter = new ZeppOsStorageAdapter({
    getItem() {
      return 12345
    }
  })

  assert.equal(await adapter.load(STORAGE_KEY), '12345')
})

test('ZeppOsStorageAdapter gracefully handles save/load/clear runtime errors', async () => {
  const adapter = new ZeppOsStorageAdapter({
    setItem() {
      throw new Error('write failed')
    },
    getItem() {
      throw new Error('read failed')
    },
    removeItem() {
      throw new Error('delete failed')
    }
  })

  await assert.doesNotReject(async () => {
    await adapter.save(STORAGE_KEY, 'payload')
  })
  assert.equal(await adapter.load(STORAGE_KEY), null)
  await assert.doesNotReject(async () => {
    await adapter.clear(STORAGE_KEY)
  })
})

test('MatchStorage save/load/clear round-trip uses schema storage key', async () => {
  const store = new Map()
  const calls = []
  const adapter = {
    async save(key, value) {
      calls.push({ method: 'save', key })
      store.set(key, value)
    },
    async load(key) {
      calls.push({ method: 'load', key })
      return store.has(key) ? store.get(key) : null
    },
    async clear(key) {
      calls.push({ method: 'clear', key })
      store.delete(key)
    }
  }
  const matchStorage = new MatchStorage(adapter)
  const state = createDefaultMatchState()

  await matchStorage.saveMatchState(state)
  const loadedState = await matchStorage.loadMatchState()
  await matchStorage.clearMatchState()
  const loadedAfterClear = await matchStorage.loadMatchState()

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
    async save(key, value) {
      calls.push({ key, value })
    },
    async load() {
      return null
    },
    async clear() {}
  }
  const matchStorage = new MatchStorage(adapter)
  const state = createDefaultMatchState()
  const fixedTimestamp = 1700000000123
  const originalDateNow = Date.now
  state.updatedAt = 0

  Date.now = () => fixedTimestamp

  try {
    await matchStorage.saveMatchState(state)
  } finally {
    Date.now = originalDateNow
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].key, STORAGE_KEY)
  assert.equal(state.updatedAt, fixedTimestamp)
  assert.equal(calls[0].value, serializeMatchState(state))
})

test('MatchStorage ignores invalid state payloads on save', async () => {
  const calls = []
  const adapter = {
    async save(key, value) {
      calls.push({ key, value })
    },
    async load() {
      return null
    },
    async clear() {}
  }
  const matchStorage = new MatchStorage(adapter)

  await matchStorage.saveMatchState({ status: 'active' })

  assert.deepEqual(calls, [])
})

test('MatchStorage returns null when adapter payload is missing', async () => {
  const payloads = [null, undefined, '']
  const adapter = {
    async save() {},
    async load() {
      return payloads.shift() ?? null
    },
    async clear() {}
  }
  const matchStorage = new MatchStorage(adapter)

  assert.equal(await matchStorage.loadMatchState(), null)
  assert.equal(await matchStorage.loadMatchState(), null)
  assert.equal(await matchStorage.loadMatchState(), null)
})

test('MatchStorage loads valid serialized payloads', async () => {
  const state = createDefaultMatchState()
  const matchStorage = new MatchStorage({
    async save() {},
    async load() {
      return serializeMatchState(state)
    },
    async clear() {}
  })

  assert.deepEqual(await matchStorage.loadMatchState(), state)
})

test('MatchStorage returns null when adapter payload is corrupted JSON', async () => {
  const matchStorage = new MatchStorage({
    async save() {},
    async load() {
      return '{bad-json'
    },
    async clear() {}
  })

  assert.equal(await matchStorage.loadMatchState(), null)
})

test('MatchStorage returns null when adapter payload is malformed JSON shape', async () => {
  const state = createDefaultMatchState()
  const malformedPayload = JSON.stringify({
    status: state.status,
    setsToPlay: state.setsToPlay,
    setsNeededToWin: state.setsNeededToWin
  })
  const matchStorage = new MatchStorage({
    async save() {},
    async load() {
      return malformedPayload
    },
    async clear() {}
  })

  assert.equal(await matchStorage.loadMatchState(), null)
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
    async save() {},
    async load() {
      return invalidPayload
    },
    async clear() {}
  })

  assert.equal(await matchStorage.loadMatchState(), null)
})

test('MatchStorage supports sequential save-load cycles with latest state wins', async () => {
  const store = new Map()
  const matchStorage = new MatchStorage({
    async save(key, value) {
      store.set(key, value)
    },
    async load(key) {
      return store.has(key) ? store.get(key) : null
    },
    async clear(key) {
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
    await matchStorage.saveMatchState(firstState)
    assert.deepEqual(await matchStorage.loadMatchState(), firstState)

    await matchStorage.saveMatchState(secondState)
    assert.deepEqual(await matchStorage.loadMatchState(), secondState)
  } finally {
    Date.now = originalDateNow
  }
})

test('MatchStorage loadMatchState never throws when adapter load fails', async () => {
  const matchStorage = new MatchStorage({
    async save() {},
    async load() {
      throw new Error('read failed')
    },
    async clear() {}
  })

  await assert.doesNotReject(async () => {
    assert.equal(await matchStorage.loadMatchState(), null)
  })
})

test('MatchStorage clearMatchState never throws when adapter clear fails', async () => {
  const matchStorage = new MatchStorage({
    async save() {},
    async load() {
      return null
    },
    async clear() {
      throw new Error('delete failed')
    }
  })

  await assert.doesNotReject(async () => {
    await matchStorage.clearMatchState()
  })
})

test('clearMatchState utility clears stored payload and is safe when storage is already empty', async () => {
  const store = new Map()
  const originalAdapter = matchStorage.adapter

  matchStorage.adapter = {
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

  try {
    await matchStorage.saveMatchState(createDefaultMatchState())
    assert.equal(store.has(STORAGE_KEY), true)

    await clearStoredMatchState()
    assert.equal(store.has(STORAGE_KEY), false)

    await assert.doesNotReject(async () => {
      await clearStoredMatchState()
    })
  } finally {
    matchStorage.adapter = originalAdapter
  }
})
