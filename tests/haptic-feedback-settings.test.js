import assert from 'node:assert/strict'
import test from 'node:test'

import { clearAllAppData } from '../utils/app-data-clear.js'
import {
  clearHapticFeedbackEnabled,
  HAPTIC_FEEDBACK_STORAGE_KEY,
  loadHapticFeedbackEnabled,
  saveHapticFeedbackEnabled
} from '../utils/haptic-feedback-settings.js'
import {
  createHmFsMock,
  readFileStoreKey,
  storageKeyToFilename
} from './helpers/hmfs-mock.js'

const HAPTIC_FEEDBACK_FILENAME = storageKeyToFilename(
  HAPTIC_FEEDBACK_STORAGE_KEY
)

test('loadHapticFeedbackEnabled defaults to true when key is missing', () => {
  const originalHmFS = globalThis.hmFS
  const { mock } = createHmFsMock()

  globalThis.hmFS = mock

  try {
    assert.equal(loadHapticFeedbackEnabled(), true)
  } finally {
    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
})

test('saveHapticFeedbackEnabled persists false value', () => {
  const originalHmFS = globalThis.hmFS
  const { mock, fileStore } = createHmFsMock()

  globalThis.hmFS = mock

  try {
    saveHapticFeedbackEnabled(false)

    assert.equal(
      readFileStoreKey(fileStore, HAPTIC_FEEDBACK_STORAGE_KEY),
      'false'
    )
    assert.equal(loadHapticFeedbackEnabled(), false)
  } finally {
    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
})

test('saveHapticFeedbackEnabled enables only when value is true boolean', () => {
  const originalHmFS = globalThis.hmFS
  const { mock, fileStore } = createHmFsMock()

  globalThis.hmFS = mock

  try {
    assert.equal(saveHapticFeedbackEnabled(1), false)
    assert.equal(
      readFileStoreKey(fileStore, HAPTIC_FEEDBACK_STORAGE_KEY),
      'false'
    )

    assert.equal(saveHapticFeedbackEnabled(true), true)
    assert.equal(
      readFileStoreKey(fileStore, HAPTIC_FEEDBACK_STORAGE_KEY),
      'true'
    )
  } finally {
    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
})

test('clearHapticFeedbackEnabled resets to default true', () => {
  const originalHmFS = globalThis.hmFS
  const { mock, fileStore } = createHmFsMock()

  globalThis.hmFS = mock

  try {
    saveHapticFeedbackEnabled(false)
    assert.equal(loadHapticFeedbackEnabled(), false)

    clearHapticFeedbackEnabled()

    assert.equal(fileStore.has(HAPTIC_FEEDBACK_FILENAME), false)
    assert.equal(loadHapticFeedbackEnabled(), true)
  } finally {
    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
})

test('clearAllAppData resets haptic setting to default enabled', () => {
  const originalHmFS = globalThis.hmFS
  const { mock } = createHmFsMock()

  globalThis.hmFS = mock

  try {
    saveHapticFeedbackEnabled(false)
    assert.equal(loadHapticFeedbackEnabled(), false)

    clearAllAppData()

    assert.equal(loadHapticFeedbackEnabled(), true)
  } finally {
    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
})
