import { getScreenMetrics } from './screen-utils.js'

const KEEP_AWAKE_DURATION = 2147483
const DEFAULT_TOAST_DURATION = 2000
const DEFAULT_VIBRATION_DURATION = 50
const STORAGE_VALUE_PREFIX = '__padel_buddy_platform_adapters__:'
const STORAGE_VALUE_MISSING = Symbol('storage-value-missing')
const STORAGE_VALUE_INVALID = Symbol('storage-value-invalid')

const fallbackStorage = createInMemoryStorage()
const gestureRegistrations = []

let legacyGestureDispatcherRegistered = false
let keepAwakeEnabled = false
let legacyVibrateSensor = null
let legacyVibrateSensorResolved = false
let cachedLocalStorageConstructor = null
let cachedLocalStorageInstance = null

const fallbackToastState = {
  visible: false,
  message: '',
  duration: DEFAULT_TOAST_DURATION
}

export const router = {
  navigateTo(pagePath, params) {
    const payload = createNavigationPayload(pagePath, params)
    const modernRouter = resolveModernRouter()

    if (modernRouter && typeof modernRouter.push === 'function') {
      try {
        modernRouter.push(payload)
        return true
      } catch {
        // Ignore runtime navigation failures.
      }
    }

    const legacyApp = resolveLegacyApp()

    if (legacyApp && typeof legacyApp.gotoPage === 'function') {
      try {
        legacyApp.gotoPage({ url: payload.url })
        return true
      } catch {
        // Ignore runtime navigation failures.
      }
    }

    return false
  },

  redirectTo(pagePath, params) {
    const payload = createNavigationPayload(pagePath, params)
    const modernRouter = resolveModernRouter()

    if (modernRouter) {
      const redirect =
        resolveFunction(modernRouter, 'replace') ||
        resolveFunction(modernRouter, 'redirectTo') ||
        resolveFunction(modernRouter, 'replacePage') ||
        resolveFunction(modernRouter, 'push')

      if (redirect) {
        try {
          redirect(payload)
          return true
        } catch {
          // Ignore runtime navigation failures.
        }
      }
    }

    const legacyApp = resolveLegacyApp()

    if (legacyApp && typeof legacyApp.gotoPage === 'function') {
      try {
        legacyApp.gotoPage({ url: payload.url })
        return true
      } catch {
        // Ignore runtime navigation failures.
      }
    }

    return false
  },

  navigateBack(delta = 1) {
    const normalizedDelta = normalizePositiveInteger(delta, 1)
    const modernRouter = resolveModernRouter()

    if (modernRouter && typeof modernRouter.back === 'function') {
      try {
        modernRouter.back({ delta: normalizedDelta })
        return true
      } catch {
        try {
          modernRouter.back(normalizedDelta)
          return true
        } catch {
          // Ignore runtime navigation failures.
        }
      }
    }

    const legacyApp = resolveLegacyApp()

    if (legacyApp && typeof legacyApp.goBack === 'function') {
      try {
        for (let index = 0; index < normalizedDelta; index += 1) {
          legacyApp.goBack()
        }
        return true
      } catch {
        // Ignore runtime navigation failures.
      }
    }

    return false
  }
}

export const gesture = {
  registerGesture(element, gestureType, callback) {
    if (typeof callback !== 'function') {
      return false
    }

    const normalizedType = normalizeGestureType(gestureType)
    const registration = {
      element,
      gestureType: normalizedType,
      callback,
      runtime: 'fallback'
    }

    removeGestureRegistration(element, normalizedType, callback)
    gestureRegistrations.push(registration)

    const interactionApi = resolveInteractionApi()

    if (interactionApi && typeof interactionApi.onGesture === 'function') {
      try {
        interactionApi.onGesture(normalizedType, callback)
        registration.runtime = 'modern'
        return true
      } catch {
        // Keep the in-memory registration as a fallback.
      }
    }

    const legacyApp = resolveLegacyApp()

    if (
      legacyApp &&
      typeof legacyApp.registerGestureEvent === 'function' &&
      !legacyGestureDispatcherRegistered
    ) {
      try {
        legacyApp.registerGestureEvent((event) => dispatchLegacyGesture(event))
        legacyGestureDispatcherRegistered = true
        registration.runtime = 'legacy'
        return true
      } catch {
        // Keep the in-memory registration as a fallback.
      }
    }

    return legacyGestureDispatcherRegistered
  },

  unregisterGesture(element, gestureType) {
    const normalizedType = normalizeGestureType(gestureType)
    const matchingRegistrations = gestureRegistrations.filter(
      (registration) => {
        return (
          registration.element === element &&
          registration.gestureType === normalizedType
        )
      }
    )

    if (matchingRegistrations.length === 0) {
      return false
    }

    const interactionApi = resolveInteractionApi()

    if (interactionApi && typeof interactionApi.offGesture === 'function') {
      for (let index = 0; index < matchingRegistrations.length; index += 1) {
        const registration = matchingRegistrations[index]

        try {
          interactionApi.offGesture(normalizedType, registration.callback)
        } catch {
          try {
            interactionApi.offGesture(normalizedType)
          } catch {
            // Ignore runtime gesture cleanup failures.
          }
        }
      }
    }

    removeGestureRegistration(element, normalizedType)

    const legacyApp = resolveLegacyApp()

    if (
      legacyApp &&
      typeof legacyApp.unregisterGestureEvent === 'function' &&
      gestureRegistrations.length === 0 &&
      legacyGestureDispatcherRegistered
    ) {
      try {
        legacyApp.unregisterGestureEvent()
      } catch {
        // Ignore runtime gesture cleanup failures.
      }

      legacyGestureDispatcherRegistered = false
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

    const interactionApi = resolveInteractionApi()

    if (interactionApi && typeof interactionApi.showToast === 'function') {
      try {
        interactionApi.showToast({
          content: fallbackToastState.message,
          text: fallbackToastState.message,
          duration: fallbackToastState.duration
        })
        return true
      } catch {
        // Keep local state only.
      }
    }

    const legacyUi = resolveLegacyUi()

    if (legacyUi && typeof legacyUi.showToast === 'function') {
      try {
        legacyUi.showToast({
          text: fallbackToastState.message,
          duration: fallbackToastState.duration
        })
        return true
      } catch {
        // Keep local state only.
      }
    }

    return false
  },

  hideToast() {
    fallbackToastState.visible = false

    const interactionApi = resolveInteractionApi()
    const hideInteractionToast =
      resolveFunction(interactionApi, 'hideToast') ||
      resolveFunction(interactionApi, 'closeToast')

    if (hideInteractionToast) {
      try {
        hideInteractionToast()
        return true
      } catch {
        // Keep local state only.
      }
    }

    const legacyUi = resolveLegacyUi()

    if (legacyUi && typeof legacyUi.hideToast === 'function') {
      try {
        legacyUi.hideToast()
        return true
      } catch {
        // Keep local state only.
      }
    }

    return false
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

    const displayApi = resolveDisplayApi()

    if (displayApi && applyModernKeepAwake(displayApi, keepAwakeEnabled)) {
      return keepAwakeEnabled
    }

    const legacySetting = resolveLegacySetting()

    if (legacySetting) {
      try {
        if (keepAwakeEnabled) {
          legacySetting.setBrightScreen?.(KEEP_AWAKE_DURATION)
        } else {
          legacySetting.setBrightScreenCancel?.()
        }
      } catch {
        // Ignore runtime display failures.
      }
    }

    return keepAwakeEnabled
  },

  getKeepAwakeStatus() {
    return keepAwakeEnabled
  }
}

export const storage = {
  setItem(key, value) {
    const normalizedKey = String(key)
    const runtimeStorage = resolveRuntimeStorage()
    let serializedValue = null

    try {
      serializedValue = serializeStorageValue(value)
    } catch {
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

    if (runtimeStorage) {
      try {
        runtimeStorage.removeItem?.(normalizedKey)
        runtimeStorage.deleteItem?.(normalizedKey)
      } catch {
        // Ignore runtime storage failures.
      }
    }

    return true
  },

  clear() {
    const runtimeStorage = resolveRuntimeStorage()

    fallbackStorage.clear()

    if (runtimeStorage) {
      try {
        runtimeStorage.clear?.()
      } catch {
        // Ignore runtime storage failures.
      }
    }
  }
}

export const haptics = {
  vibrate(duration = DEFAULT_VIBRATION_DURATION) {
    const normalizedDuration = normalizePositiveInteger(
      duration,
      DEFAULT_VIBRATION_DURATION
    )
    const modernHaptics = resolveModernHaptics()

    if (modernHaptics) {
      const vibrateOnce =
        resolveFunction(modernHaptics, 'vibrate') ||
        resolveFunction(modernHaptics, 'start')

      if (vibrateOnce) {
        try {
          vibrateOnce(normalizedDuration)
          return true
        } catch {
          // Fall through to legacy vibration.
        }
      }
    }

    const legacySensor = resolveLegacyVibrateSensor()

    if (legacySensor && typeof legacySensor.start === 'function') {
      try {
        legacySensor.stop?.()
        legacySensor.start()

        if (
          typeof setTimeout === 'function' &&
          typeof legacySensor.stop === 'function'
        ) {
          setTimeout(() => {
            try {
              legacySensor.stop()
            } catch {
              // Ignore stop failures.
            }
          }, normalizedDuration)
        }

        return true
      } catch {
        // Ignore runtime haptic failures.
      }
    }

    return false
  },

  vibratePattern(pattern) {
    const normalizedPattern = normalizeVibrationPattern(pattern)
    const modernHaptics = resolveModernHaptics()

    if (modernHaptics) {
      const vibratePattern =
        resolveFunction(modernHaptics, 'vibratePattern') ||
        resolveFunction(modernHaptics, 'playPattern')

      if (vibratePattern) {
        try {
          vibratePattern(normalizedPattern)
          return true
        } catch {
          // Fall through to legacy vibration.
        }
      }
    }

    const totalDuration = normalizedPattern.reduce((sum, step) => sum + step, 0)
    return this.vibrate(
      totalDuration > 0 ? totalDuration : DEFAULT_VIBRATION_DURATION
    )
  }
}

function resolveRuntimeObject(...keys) {
  if (typeof globalThis === 'undefined') {
    return null
  }

  for (let index = 0; index < keys.length; index += 1) {
    const candidate = globalThis[keys[index]]

    if (candidate) {
      return candidate
    }
  }

  return null
}

function resolveModernRouter() {
  return resolveRuntimeObject('__zosRouter', 'router')
}

function resolveInteractionApi() {
  return resolveRuntimeObject('__zosInteraction', 'interaction')
}

function resolveDisplayApi() {
  return resolveRuntimeObject('__zosDisplay', 'display')
}

function resolveModernHaptics() {
  return resolveRuntimeObject('__zosHaptics', 'haptics', 'vibrator')
}

function resolveDeviceApi() {
  return resolveRuntimeObject('__zosDevice', 'device')
}

function resolveLegacyApp() {
  return resolveRuntimeObject('hmApp')
}

function resolveLegacyUi() {
  return resolveRuntimeObject('hmUI')
}

function resolveLegacySetting() {
  return resolveRuntimeObject('hmSetting')
}

function resolveLegacySensorApi() {
  return resolveRuntimeObject('hmSensor')
}

function resolveRuntimeDeviceInfo() {
  const deviceApi = resolveDeviceApi()

  if (deviceApi && typeof deviceApi.getDeviceInfo === 'function') {
    try {
      return deviceApi.getDeviceInfo() ?? null
    } catch {
      return null
    }
  }

  const legacySetting = resolveLegacySetting()

  if (legacySetting && typeof legacySetting.getDeviceInfo === 'function') {
    try {
      return legacySetting.getDeviceInfo() ?? null
    } catch {
      return null
    }
  }

  return null
}

function resolveRuntimeStorage() {
  const directStorage = resolveRuntimeObject('__zosStorage', 'localStorage')

  if (isStorageLike(directStorage)) {
    return directStorage
  }

  const localStorageConstructor = resolveRuntimeObject('LocalStorage')

  if (typeof localStorageConstructor === 'function') {
    try {
      if (cachedLocalStorageConstructor !== localStorageConstructor) {
        cachedLocalStorageConstructor = localStorageConstructor
        cachedLocalStorageInstance = new localStorageConstructor()
      }

      if (isStorageLike(cachedLocalStorageInstance)) {
        return cachedLocalStorageInstance
      }
    } catch {
      // Ignore constructor failures.
    }
  }

  const settingsStorage = resolveRuntimeObject('settingsStorage')

  if (isStorageLike(settingsStorage)) {
    return settingsStorage
  }

  return null
}

function resolveLegacyVibrateSensor() {
  if (legacyVibrateSensorResolved) {
    return legacyVibrateSensor
  }

  legacyVibrateSensorResolved = true
  const sensorApi = resolveLegacySensorApi()

  if (
    !sensorApi ||
    typeof sensorApi.createSensor !== 'function' ||
    !sensorApi.id ||
    typeof sensorApi.id.VIBRATE === 'undefined'
  ) {
    legacyVibrateSensor = null
    return legacyVibrateSensor
  }

  try {
    legacyVibrateSensor = sensorApi.createSensor(sensorApi.id.VIBRATE) || null
  } catch {
    legacyVibrateSensor = null
  }

  return legacyVibrateSensor
}

function dispatchLegacyGesture(event) {
  const normalizedType = normalizeGestureType(
    event,
    resolveLegacyApp()?.gesture ?? null
  )
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
    url: buildNavigationUrl(normalizedPath, params),
    params: normalizeParams(params)
  }
}

function buildNavigationUrl(pagePath, params) {
  const normalizedParams = normalizeParams(params)
  const paramEntries = Object.entries(normalizedParams)

  if (paramEntries.length === 0) {
    return pagePath
  }

  const query = paramEntries
    .map(([key, value]) => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(stringifyNavigationValue(value))}`
    })
    .join('&')

  return `${pagePath}?${query}`
}

function normalizeParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {}
  }

  return params
}

function stringifyNavigationValue(value) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value === null || typeof value === 'undefined') {
    return ''
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function normalizeGestureType(gestureType, gestureMap = null) {
  if (gestureMap) {
    const entries = Object.entries(gestureMap)

    for (let index = 0; index < entries.length; index += 1) {
      const [key, value] = entries[index]

      if (gestureType === key || gestureType === value) {
        return key
      }
    }
  }

  return String(gestureType ?? '')
    .trim()
    .toUpperCase()
}

function applyModernKeepAwake(displayApi, enabled) {
  const methods = enabled
    ? ['setPageBrightTime', 'pauseDropWristScreenOff']
    : ['resetPageBrightTime', 'resetDropWristScreenOff']
  const availableMethods = methods.filter((method) => {
    return typeof displayApi?.[method] === 'function'
  })

  if (availableMethods.length === 0) {
    return false
  }

  try {
    for (let index = 0; index < availableMethods.length; index += 1) {
      const method = availableMethods[index]

      if (method === 'setPageBrightTime') {
        displayApi[method](KEEP_AWAKE_DURATION)
      } else {
        displayApi[method]()
      }
    }

    return true
  } catch {
    return false
  }
}

function resolveScreenShape(screenShape, width, height) {
  if (typeof screenShape === 'string') {
    const normalizedShape = screenShape.trim().toLowerCase()

    if (normalizedShape === 'round' || normalizedShape === 'square') {
      return normalizedShape
    }

    if (normalizedShape === 'r') {
      return 'round'
    }

    if (normalizedShape === 's') {
      return 'square'
    }
  }

  return Math.abs(width - height) <= Math.round(width * 0.04)
    ? 'round'
    : 'square'
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
  return `${STORAGE_VALUE_PREFIX}${JSON.stringify(value)}`
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

function resolveFunction(target, key) {
  if (!target || typeof target[key] !== 'function') {
    return null
  }

  return target[key].bind(target)
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
