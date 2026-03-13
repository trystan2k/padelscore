const DEFAULT_DEVICE_INFO = {
  width: 390,
  height: 450,
  screenShape: 'square',
  isRound: false
}
const DEFAULT_TOAST_DURATION = 2000
const DEFAULT_VIBRATION_DURATION = 50

const state = createInitialState()

export const router = {
  navigateTo(pagePath, params = {}) {
    state.routerHistory.push({
      type: 'navigateTo',
      pagePath,
      params
    })

    return true
  },

  redirectTo(pagePath, params = {}) {
    state.routerHistory.push({
      type: 'redirectTo',
      pagePath,
      params
    })

    return true
  },

  navigateBack(delta = 1) {
    state.routerHistory.push({
      type: 'navigateBack',
      delta: normalizePositiveInteger(delta, 1)
    })

    return true
  }
}

export const gesture = {
  registerGesture(element, gestureType, callback) {
    state.gestures.push({
      element,
      gestureType: normalizeGestureType(gestureType),
      callback
    })

    return true
  },

  unregisterGesture(element, gestureType) {
    const normalizedType = normalizeGestureType(gestureType)
    const initialLength = state.gestures.length

    for (let index = state.gestures.length - 1; index >= 0; index -= 1) {
      const registration = state.gestures[index]

      if (
        registration.element === element &&
        registration.gestureType === normalizedType
      ) {
        state.gestures.splice(index, 1)
      }
    }

    return initialLength !== state.gestures.length
  }
}

export const toast = {
  showToast(message, duration = DEFAULT_TOAST_DURATION) {
    state.toast = {
      visible: true,
      message: String(message ?? ''),
      duration: normalizePositiveInteger(duration, DEFAULT_TOAST_DURATION)
    }

    return true
  },

  hideToast() {
    state.toast.visible = false
    return true
  }
}

export const deviceInfo = {
  getDeviceInfo() {
    return { ...state.deviceInfo }
  },

  isRoundScreen() {
    return state.deviceInfo.isRound === true
  }
}

export const keepAwake = {
  setKeepAwake(enabled) {
    state.keepAwake = enabled === true
    return state.keepAwake
  },

  getKeepAwakeStatus() {
    return state.keepAwake
  }
}

export const storage = {
  setItem(key, value) {
    state.storage.set(String(key), cloneValue(value))
    return value
  },

  getItem(key) {
    return state.storage.has(String(key))
      ? cloneValue(state.storage.get(String(key)))
      : null
  },

  removeItem(key) {
    state.storage.delete(String(key))
    return true
  },

  clear() {
    state.storage.clear()
  }
}

export const haptics = {
  vibrate(duration) {
    state.hapticsCalls.push({
      type: 'vibrate',
      duration: normalizePositiveInteger(duration, DEFAULT_VIBRATION_DURATION)
    })
    return true
  },

  vibratePattern(pattern) {
    state.hapticsCalls.push({
      type: 'vibratePattern',
      pattern: normalizeVibrationPattern(pattern)
    })
    return true
  }
}

export function resetPlatformAdaptersMock() {
  state.routerHistory = []
  state.gestures = []
  state.toast = {
    visible: false,
    message: '',
    duration: 0
  }
  state.storage = new Map()
  state.keepAwake = false
  state.deviceInfo = { ...DEFAULT_DEVICE_INFO }
  state.hapticsCalls = []
}

export function getRouterHistory() {
  return state.routerHistory.map((entry) => ({ ...entry }))
}

export function getGestureRegistrations() {
  return state.gestures.map((registration) => ({
    element: registration.element,
    gestureType: registration.gestureType,
    callback: registration.callback
  }))
}

export function triggerGesture(
  element,
  gestureType,
  eventPayload = gestureType
) {
  const normalizedType = normalizeGestureType(gestureType)
  let handled = false

  for (let index = 0; index < state.gestures.length; index += 1) {
    const registration = state.gestures[index]

    if (
      registration.element !== element ||
      registration.gestureType !== normalizedType
    ) {
      continue
    }

    if (registration.callback(eventPayload) === true) {
      handled = true
    }
  }

  return handled
}

export function getToastState() {
  return { ...state.toast }
}

export function getStorageSnapshot() {
  return Object.fromEntries(
    Array.from(state.storage.entries(), ([key, value]) => [
      key,
      cloneValue(value)
    ])
  )
}

export function setMockDeviceInfo(nextDeviceInfo) {
  const width = ensureFiniteNumber(
    nextDeviceInfo?.width,
    DEFAULT_DEVICE_INFO.width
  )
  const height = ensureFiniteNumber(
    nextDeviceInfo?.height,
    DEFAULT_DEVICE_INFO.height
  )
  const isRound =
    typeof nextDeviceInfo?.isRound === 'boolean'
      ? nextDeviceInfo.isRound
      : Math.abs(width - height) <= Math.round(width * 0.04)

  state.deviceInfo = {
    ...DEFAULT_DEVICE_INFO,
    ...nextDeviceInfo,
    width,
    height,
    screenShape: isRound ? 'round' : 'square',
    isRound
  }
}

export function getKeepAwakeState() {
  return state.keepAwake
}

export function getHapticsCalls() {
  return state.hapticsCalls.map((entry) => {
    return entry.type === 'vibratePattern'
      ? { ...entry, pattern: [...entry.pattern] }
      : { ...entry }
  })
}

function createInitialState() {
  return {
    routerHistory: [],
    gestures: [],
    toast: {
      visible: false,
      message: '',
      duration: 0
    },
    storage: new Map(),
    keepAwake: false,
    deviceInfo: { ...DEFAULT_DEVICE_INFO },
    hapticsCalls: []
  }
}

function normalizePositiveInteger(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }

  return fallback
}

function normalizeVibrationPattern(pattern) {
  if (!Array.isArray(pattern)) {
    return []
  }

  return pattern
    .map((step) => normalizePositiveInteger(step, 0))
    .filter((step) => step > 0)
}

function normalizeGestureType(gestureType) {
  return String(gestureType ?? '')
    .trim()
    .toUpperCase()
}

function cloneValue(value) {
  if (typeof value === 'undefined') {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

function ensureFiniteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
