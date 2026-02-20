import assert from 'node:assert/strict'
import test from 'node:test'

import { createInitialMatchState } from '../utils/match-state.js'
import { MATCH_STATE_STORAGE_KEY, loadState, saveState } from '../utils/storage.js'

test('saveState serializes MatchState and persists it with the stable storage key', () => {
  const state = createInitialMatchState(1700000000)
  const originalSettingsStorage = globalThis.settingsStorage

  let capturedKey = ''
  let capturedValue = ''

  globalThis.settingsStorage = {
    setItem(key, value) {
      capturedKey = key
      capturedValue = value
    }
  }

  try {
    saveState(state)
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }

  assert.equal(capturedKey, MATCH_STATE_STORAGE_KEY)
  assert.equal(capturedValue, JSON.stringify(state))
  assert.deepEqual(JSON.parse(capturedValue), state)
})

test('loadState retrieves and parses saved MatchState using the stable storage key', () => {
  const state = createInitialMatchState(1700000000)
  const originalSettingsStorage = globalThis.settingsStorage

  let capturedKey = ''

  globalThis.settingsStorage = {
    getItem(key) {
      capturedKey = key
      return JSON.stringify(state)
    }
  }

  let loadedState

  try {
    loadedState = loadState()
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }

  assert.equal(capturedKey, MATCH_STATE_STORAGE_KEY)
  assert.deepEqual(loadedState, state)
})

test('loadState returns null when no saved state exists', () => {
  const originalSettingsStorage = globalThis.settingsStorage

  let capturedKey = ''

  globalThis.settingsStorage = {
    getItem(key) {
      capturedKey = key
      return null
    }
  }

  let loadedState

  try {
    loadedState = loadState()
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }

  assert.equal(capturedKey, MATCH_STATE_STORAGE_KEY)
  assert.equal(loadedState, null)
})

test('loadState returns null when saved state payload is corrupted JSON', () => {
  const originalSettingsStorage = globalThis.settingsStorage

  globalThis.settingsStorage = {
    getItem() {
      return '{bad-json'
    }
  }

  let loadedState

  try {
    loadedState = loadState()
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }

  assert.equal(loadedState, null)
})

test('saveState and loadState gracefully fallback when settingsStorage is unavailable', () => {
  const state = createInitialMatchState(1700000001)
  const originalSettingsStorage = globalThis.settingsStorage

  if (typeof originalSettingsStorage !== 'undefined') {
    delete globalThis.settingsStorage
  }

  let loadedState

  try {
    assert.doesNotThrow(() => saveState(state))
    loadedState = loadState()
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }

  assert.deepEqual(loadedState, state)
})

test('loadState returns null when payload is valid JSON but invalid MatchState shape', () => {
  const originalSettingsStorage = globalThis.settingsStorage

  globalThis.settingsStorage = {
    getItem() {
      return JSON.stringify({
        teams: {
          teamA: { id: 'teamA', label: 'Team A' },
          teamB: { id: 'teamB', label: 'Team B' }
        },
        teamA: { points: 999, games: 0 },
        teamB: { points: 0, games: 0 },
        currentSetStatus: { number: 1, teamAGames: 0, teamBGames: 0 },
        currentSet: 1,
        status: 'active',
        updatedAt: 1700000000
      })
    }
  }

  let loadedState

  try {
    loadedState = loadState()
  } finally {
    if (typeof originalSettingsStorage === 'undefined') {
      delete globalThis.settingsStorage
    } else {
      globalThis.settingsStorage = originalSettingsStorage
    }
  }

  assert.equal(loadedState, null)
})
