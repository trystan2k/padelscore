import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MatchStorage,
  ZeppOsStorageAdapter
} from '../utils/match-storage.js'
import {
  STORAGE_KEY,
  createDefaultMatchState,
  serializeMatchState
} from '../utils/match-state-schema.js'

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

test('MatchStorage returns null when adapter payload is empty, corrupted, or invalid', async () => {
  const state = createDefaultMatchState()
  const payloads = ['', '{bad-json', JSON.stringify({ foo: 'bar' }), serializeMatchState(state)]
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
  assert.deepEqual(await matchStorage.loadMatchState(), state)
})
