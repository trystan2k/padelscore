import {
  storage as platformStorage,
  resetPlatformAdaptersState
} from '../../utils/platform-adapters.js'

export function createLocalStorageMock(initialEntries = {}) {
  const store = new Map(
    Object.entries(initialEntries).map(([key, value]) => [key, String(value)])
  )

  return {
    storage: {
      setItem(key, value) {
        store.set(String(key), String(value))
      },
      getItem(key) {
        return store.has(String(key)) ? store.get(String(key)) : null
      },
      removeItem(key) {
        store.delete(String(key))
      },
      clear() {
        store.clear()
      }
    },
    getRaw(key) {
      return store.has(String(key)) ? store.get(String(key)) : null
    },
    has(key) {
      return store.has(String(key))
    },
    snapshot() {
      return Object.fromEntries(store.entries())
    }
  }
}

export function withMockLocalStorage(mockStorage, callback) {
  const originalLocalStorage = globalThis.localStorage
  const originalZosStorage = globalThis.__zosStorage

  const cleanup = () => {
    delete globalThis.localStorage
    delete globalThis.__zosStorage
    platformStorage.clear()
    resetPlatformAdaptersState()

    if (typeof originalLocalStorage !== 'undefined') {
      globalThis.localStorage = originalLocalStorage
    }

    if (typeof originalZosStorage !== 'undefined') {
      globalThis.__zosStorage = originalZosStorage
    }
  }

  delete globalThis.localStorage
  delete globalThis.__zosStorage
  platformStorage.clear()
  resetPlatformAdaptersState()
  globalThis.localStorage = mockStorage
  globalThis.__zosStorage = { localStorage: mockStorage }

  try {
    const result = callback()

    if (result && typeof result.then === 'function') {
      return result.finally(cleanup)
    }

    cleanup()
    return result
  } catch (error) {
    cleanup()
    throw error
  }
}
