function createFallbackStorage() {
  const values = new Map()
  return {
    setItem(key, value) {
      values.set(String(key), value)
    },
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null
    },
    removeItem(key) {
      values.delete(String(key))
    },
    clear() {
      values.clear()
    }
  }
}

function getStorage() {
  const runtimeStorage =
    globalThis.__zosStorage?.localStorage ??
    globalThis.localStorage ??
    globalThis.settingsStorage ??
    null

  if (runtimeStorage) {
    return runtimeStorage
  }

  if (!globalThis.__zosLocalStorageFallback) {
    globalThis.__zosLocalStorageFallback = createFallbackStorage()
  }

  return globalThis.__zosLocalStorageFallback
}

export class LocalStorage {
  setItem(key, value) {
    getStorage().setItem(key, value)
  }

  getItem(key) {
    return getStorage().getItem(key)
  }

  removeItem(key) {
    getStorage().removeItem(key)
  }

  clear() {
    getStorage().clear()
  }

  get length() {
    return getStorage().length ?? 0
  }

  key(index) {
    return getStorage().key?.(index) ?? null
  }
}
