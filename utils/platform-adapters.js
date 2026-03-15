import { getDeviceInfo } from '@zos/device'
import {
  pauseDropWristScreenOff,
  pausePalmScreenOff,
  resetDropWristScreenOff,
  resetPageBrightTime,
  resetPalmScreenOff,
  setPageBrightTime
} from '@zos/display'
import {
  GESTURE_DOWN,
  GESTURE_LEFT,
  GESTURE_RIGHT,
  GESTURE_UP,
  offGesture,
  onGesture,
  showToast
} from '@zos/interaction'
import { back, exit, home, push, replace } from '@zos/router'
import { checkSensor, Vibrator } from '@zos/sensor'
import { LocalStorage } from '@zos/storage'
import { getScreenMetrics, resolveScreenShape } from './screen-utils.js'

const KEEP_AWAKE_DURATION = 2147483
const DEFAULT_TOAST_DURATION = 2000
const DEFAULT_VIBRATION_DURATION = 50
const STORAGE_VALUE_PREFIX = '__padel_buddy_platform_adapters__:'
const STORAGE_VALUE_MISSING = Symbol('storage-value-missing')
const STORAGE_VALUE_INVALID = Symbol('storage-value-invalid')

const fallbackStorage = createInMemoryStorage()
const gestureRegistrations = []
const GESTURE_TYPE_MAP = Object.freeze({
  [GESTURE_UP]: 'UP',
  [GESTURE_DOWN]: 'DOWN',
  [GESTURE_LEFT]: 'LEFT',
  [GESTURE_RIGHT]: 'RIGHT'
})

let gestureDispatcherRegistered = false
let keepAwakeEnabled = false
let cachedLocalStorageInstance = null
let cachedVibratorInstance = null

const fallbackToastState = {
  visible: false,
  message: '',
  duration: DEFAULT_TOAST_DURATION
}

export const router = {
  navigateTo(pagePath, params) {
    try {
      push(createNavigationPayload(pagePath, params))
      return true
    } catch {
      return false
    }
  },

  redirectTo(pagePath, params) {
    try {
      replace(createNavigationPayload(pagePath, params))
      return true
    } catch {
      return false
    }
  },

  navigateBack(delta = 1) {
    const normalizedDelta = normalizePositiveInteger(delta, 1)

    try {
      for (let index = 0; index < normalizedDelta; index += 1) {
        back()
      }

      return true
    } catch {
      return false
    }
  },

  goHome() {
    try {
      home()
      return true
    } catch {
      try {
        exit()
        return true
      } catch {
        return false
      }
    }
  }
}

export const gesture = {
  registerGesture(element, gestureType, callback) {
    if (typeof callback !== 'function') {
      return false
    }

    const normalizedType = normalizeGestureType(gestureType)
    removeGestureRegistration(element, normalizedType, callback)

    gestureRegistrations.push({
      element,
      gestureType: normalizedType,
      callback
    })

    if (gestureDispatcherRegistered) {
      return true
    }

    try {
      onGesture({ callback: dispatchGesture })
      gestureDispatcherRegistered = true
      return true
    } catch {
      removeGestureRegistration(element, normalizedType, callback)
      return false
    }
  },

  unregisterGesture(element, gestureType) {
    const normalizedType = normalizeGestureType(gestureType)
    const hadRegistration = gestureRegistrations.some((registration) => {
      return (
        registration.element === element &&
        registration.gestureType === normalizedType
      )
    })

    if (!hadRegistration) {
      return false
    }

    removeGestureRegistration(element, normalizedType)

    if (gestureRegistrations.length === 0 && gestureDispatcherRegistered) {
      try {
        offGesture()
      } catch {
        // Ignore runtime gesture cleanup failures.
      }

      gestureDispatcherRegistered = false
    }

    return true
  }
}

export const toast = {
  showToast(message, duration = DEFAULT_TOAST_DURATION) {
    fallbackToastState.visible = true
    fallbackToastState.message = String(message ?? '')
    fallbackToastState.duration = normalizePositiveInteger(
      duration,
      DEFAULT_TOAST_DURATION
    )

    try {
      showToast({ content: fallbackToastState.message })
      return true
    } catch {
      return false
    }
  },

  hideToast() {
    fallbackToastState.visible = false
    return true
  }
}

export const deviceInfo = {
  getDeviceInfo() {
    const runtimeInfo = resolveRuntimeDeviceInfo()
    const fallbackMetrics = getScreenMetrics()
    const width = ensureFiniteNumber(runtimeInfo?.width, fallbackMetrics.width)
    const height = ensureFiniteNumber(
      runtimeInfo?.height,
      fallbackMetrics.height
    )
    const screenShape = resolveScreenShape(
      runtimeInfo?.screenShape,
      width,
      height
    )

    return {
      ...(runtimeInfo ?? {}),
      width,
      height,
      screenShape,
      isRound: screenShape === 'round'
    }
  },

  isRoundScreen() {
    return this.getDeviceInfo().isRound === true
  }
}

export const keepAwake = {
  setKeepAwake(enabled) {
    keepAwakeEnabled = enabled === true
    return applyKeepAwake(keepAwakeEnabled)
  },

  getKeepAwakeStatus() {
    return keepAwakeEnabled
  }
}

export const storage = {
  setItem(key, value) {
    const normalizedKey = String(key)
    const runtimeStorage = resolveRuntimeStorage()
    const serializedValue = serializeStorageValue(value)

    if (typeof serializedValue !== 'string') {
      return null
    }

    fallbackStorage.setItem(normalizedKey, serializedValue)

    if (runtimeStorage && typeof runtimeStorage.setItem === 'function') {
      try {
        runtimeStorage.setItem(normalizedKey, serializedValue)
      } catch {
        // Ignore runtime storage failures and keep the in-memory value.
      }
    }

    return value
  },

  getItem(key) {
    const normalizedKey = String(key)
    const runtimeStorage = resolveRuntimeStorage()

    if (runtimeStorage && typeof runtimeStorage.getItem === 'function') {
      try {
        const storedValue = deserializeStorageValue(
          runtimeStorage.getItem(normalizedKey)
        )

        if (
          storedValue !== STORAGE_VALUE_MISSING &&
          storedValue !== STORAGE_VALUE_INVALID
        ) {
          return storedValue
        }
      } catch {
        // Fall back to in-memory storage.
      }
    }

    const fallbackValue = deserializeStorageValue(
      fallbackStorage.getItem(normalizedKey)
    )

    if (
      fallbackValue === STORAGE_VALUE_MISSING ||
      fallbackValue === STORAGE_VALUE_INVALID
    ) {
      return null
    }

    return fallbackValue
  },

  removeItem(key) {
    const normalizedKey = String(key)
    const runtimeStorage = resolveRuntimeStorage()

    fallbackStorage.removeItem(normalizedKey)

    if (!runtimeStorage || typeof runtimeStorage.removeItem !== 'function') {
      return true
    }

    try {
      runtimeStorage.removeItem(normalizedKey)
      return true
    } catch {
      return false
    }
  },

  clear() {
    const runtimeStorage = resolveRuntimeStorage()

    fallbackStorage.clear()

    if (!runtimeStorage || typeof runtimeStorage.clear !== 'function') {
      return true
    }

    try {
      runtimeStorage.clear()
      return true
    } catch {
      return false
    }
  }
}

export const haptics = {
  vibrateLight() {
    const vibrator = resolveModernVibrator()

    if (!vibrator) {
      return false
    }

    try {
      const types =
        typeof vibrator.getType === 'function' ? vibrator.getType() : null

      if (types && typeof types.GENTLE_SHORT !== 'undefined') {
        vibrator.start([
          {
            type: types.GENTLE_SHORT,
            duration: 10
          }
        ])
        return true
      }
    } catch {
      // Fall through to mode-based vibration.
    }

    try {
      vibrator.start({
        mode: vibrator.VIBRATOR_SCENE_SHORT_LIGHT
      })
      return true
    } catch {
      try {
        vibrator.start()
        return true
      } catch {
        return false
      }
    }
  },

  vibrateStrongReminder() {
    const vibrator = resolveModernVibrator()

    if (!vibrator) {
      return false
    }

    try {
      vibrator.start({
        mode:
          vibrator.VIBRATOR_SCENE_STRONG_REMINDER ??
          vibrator.VIBRATOR_SCENE_DURATION_LONG ??
          vibrator.VIBRATOR_SCENE_DURATION
      })
      return true
    } catch {
      return this.vibratePattern([120, 120, 120, 120, 120, 120, 120])
    }
  },

  vibrate(duration = DEFAULT_VIBRATION_DURATION) {
    const normalizedDuration = normalizePositiveInteger(
      duration,
      DEFAULT_VIBRATION_DURATION
    )
    const vibrator = resolveModernVibrator()

    if (!vibrator) {
      return false
    }

    try {
      if (normalizedDuration >= 600) {
        vibrator.start({
          mode:
            normalizedDuration >= 1000
              ? (vibrator.VIBRATOR_SCENE_DURATION_LONG ?? undefined)
              : (vibrator.VIBRATOR_SCENE_DURATION ?? undefined)
        })
      } else {
        vibrator.start()
      }

      return true
    } catch {
      try {
        vibrator.start()
        return true
      } catch {
        return false
      }
    }
  },

  vibratePattern(pattern) {
    const normalizedPattern = normalizeVibrationPattern(pattern)
    const vibrator = resolveModernVibrator()

    if (!vibrator || normalizedPattern.length === 0) {
      return false
    }

    try {
      const types =
        typeof vibrator.getType === 'function' ? vibrator.getType() : null

      if (types && typeof types === 'object') {
        const actions = normalizedPattern.map((duration, index) => ({
          type:
            index % 2 === 0
              ? (types.GENTLE_SHORT ?? types.STRONG_SHORT ?? types.URGENT)
              : types.PAUSE,
          duration
        }))

        vibrator.start(actions)
        return true
      }
    } catch {
      // Fall through to single vibration fallback.
    }

    const totalDuration = normalizedPattern.reduce((sum, step) => sum + step, 0)
    return this.vibrate(
      totalDuration > 0 ? totalDuration : DEFAULT_VIBRATION_DURATION
    )
  }
}

export function resetPlatformAdaptersState() {
  gestureRegistrations.splice(0, gestureRegistrations.length)
  gestureDispatcherRegistered = false
  keepAwakeEnabled = false
  cachedLocalStorageInstance = null
  cachedVibratorInstance = null
  fallbackToastState.visible = false
  fallbackToastState.message = ''
  fallbackToastState.duration = DEFAULT_TOAST_DURATION
  fallbackStorage.clear()
}

function resolveRuntimeDeviceInfo() {
  try {
    return getDeviceInfo() ?? null
  } catch {
    return null
  }
}

function resolveRuntimeStorage() {
  if (typeof LocalStorage !== 'function') {
    return null
  }

  try {
    if (!isStorageLike(cachedLocalStorageInstance)) {
      cachedLocalStorageInstance = new LocalStorage()
    }

    if (isStorageLike(cachedLocalStorageInstance)) {
      return cachedLocalStorageInstance
    }
  } catch {
    cachedLocalStorageInstance = null
  }

  return null
}

function resolveModernVibrator() {
  if (cachedVibratorInstance) {
    return cachedVibratorInstance
  }

  if (typeof Vibrator !== 'function') {
    return null
  }

  try {
    if (typeof checkSensor === 'function' && checkSensor(Vibrator) === false) {
      return null
    }
  } catch {
    // Ignore availability check failures and try constructing directly.
  }

  try {
    cachedVibratorInstance = new Vibrator()
    return cachedVibratorInstance
  } catch {
    cachedVibratorInstance = null
    return null
  }
}

function dispatchGesture(event) {
  const normalizedType = normalizeGestureType(GESTURE_TYPE_MAP[event] ?? event)
  let handled = false

  for (let index = 0; index < gestureRegistrations.length; index += 1) {
    const registration = gestureRegistrations[index]

    if (registration.gestureType !== normalizedType) {
      continue
    }

    try {
      if (registration.callback(event) === true) {
        handled = true
      }
    } catch {
      // Ignore handler failures so other callbacks can continue.
    }
  }

  return handled
}

function removeGestureRegistration(element, gestureType, callback) {
  for (let index = gestureRegistrations.length - 1; index >= 0; index -= 1) {
    const registration = gestureRegistrations[index]
    const matchesElement = registration.element === element
    const matchesGestureType = registration.gestureType === gestureType
    const matchesCallback =
      typeof callback === 'undefined' || registration.callback === callback

    if (matchesElement && matchesGestureType && matchesCallback) {
      gestureRegistrations.splice(index, 1)
    }
  }
}

function createNavigationPayload(pagePath, params) {
  const normalizedPath = typeof pagePath === 'string' ? pagePath : ''
  return {
    url: normalizedPath,
    params: normalizeParams(params)
  }
}

function normalizeParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {}
  }

  return params
}

function normalizeGestureType(gestureType) {
  return String(gestureType ?? '')
    .trim()
    .toUpperCase()
}

function applyKeepAwake(enabled) {
  const methods = enabled
    ? [
        () => setPageBrightTime({ brightTime: KEEP_AWAKE_DURATION }),
        () => pauseDropWristScreenOff({}),
        () => pausePalmScreenOff({})
      ]
    : [resetPageBrightTime, resetDropWristScreenOff, resetPalmScreenOff]

  let didApply = false

  for (let index = 0; index < methods.length; index += 1) {
    try {
      methods[index]()
      didApply = true
    } catch {
      // Ignore partial display API availability.
    }
  }

  return didApply ? keepAwakeEnabled : false
}

function normalizePositiveInteger(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }

  return fallback
}

function ensureFiniteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeVibrationPattern(pattern) {
  if (!Array.isArray(pattern)) {
    return []
  }

  return pattern
    .map((step) => normalizePositiveInteger(step, 0))
    .filter((step) => step > 0)
}

function serializeStorageValue(value) {
  try {
    const serializedValue = JSON.stringify(value)

    if (typeof serializedValue !== 'string') {
      return null
    }

    return `${STORAGE_VALUE_PREFIX}${serializedValue}`
  } catch {
    return null
  }
}

function deserializeStorageValue(value) {
  if (value === null || typeof value === 'undefined') {
    return STORAGE_VALUE_MISSING
  }

  if (typeof value !== 'string') {
    return value
  }

  if (!value.startsWith(STORAGE_VALUE_PREFIX)) {
    return value
  }

  try {
    return JSON.parse(value.slice(STORAGE_VALUE_PREFIX.length))
  } catch {
    return STORAGE_VALUE_INVALID
  }
}

function isStorageLike(value) {
  return (
    value &&
    typeof value.getItem === 'function' &&
    typeof value.setItem === 'function'
  )
}

function createInMemoryStorage() {
  const values = new Map()

  return {
    setItem(key, value) {
      values.set(key, value)
    },

    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },

    removeItem(key) {
      values.delete(key)
    },

    clear() {
      values.clear()
    }
  }
}
