/**
 * @fileoverview Screen utilities for adaptive layouts across device shapes.
 *
 * Provides essential screen measurement utilities and round screen geometry
 * calculations to support adaptive layouts for both square and round screens.
 *
 * @module utils/screen-utils
 */

export const SYSTEM_HEADER_HEIGHT_SQUARE = 48
export const SCREEN_FAMILY_W390_S = 'w390-s'
export const SCREEN_FAMILY_W454_R = 'w454-r'
export const SCREEN_FAMILY_W466_R = 'w466-r'
export const SCREEN_FAMILY_W480_R = 'w480-r'
export const SCREEN_FAMILY_UNKNOWN = 'unknown'

const SQUARE_DEVICE_SOURCES = new Set([224, 225])
const SCREEN_DIMENSION_TOLERANCE = 2

const SCREEN_FAMILY_CONFIGS = Object.freeze({
  [SCREEN_FAMILY_W390_S]: Object.freeze({
    screenFamily: SCREEN_FAMILY_W390_S,
    width: 390,
    height: 450,
    screenShape: 'square',
    isRound: false,
    statusBarHeight: SYSTEM_HEADER_HEIGHT_SQUARE
  }),
  [SCREEN_FAMILY_W454_R]: Object.freeze({
    screenFamily: SCREEN_FAMILY_W454_R,
    width: 454,
    height: 454,
    screenShape: 'round',
    isRound: true,
    statusBarHeight: 0
  }),
  [SCREEN_FAMILY_W466_R]: Object.freeze({
    screenFamily: SCREEN_FAMILY_W466_R,
    width: 466,
    height: 466,
    screenShape: 'round',
    isRound: true,
    statusBarHeight: 0
  }),
  [SCREEN_FAMILY_W480_R]: Object.freeze({
    screenFamily: SCREEN_FAMILY_W480_R,
    width: 480,
    height: 480,
    screenShape: 'round',
    isRound: true,
    statusBarHeight: 0
  })
})

const SUPPORTED_SCREEN_FAMILIES = Object.freeze(
  Object.keys(SCREEN_FAMILY_CONFIGS)
)

/**
 * Retrieves screen metrics including dimensions and round screen detection.
 * Uses hmSetting.getDeviceInfo() to obtain screen dimensions.
 *
 * @param {Object|number} [overrides={}] - Optional metrics overrides for testing
 * @param {number} [overrides.safeTop] - Explicit safeTop override
 * @param {number} [overrides.statusBarHeight] - Explicit status bar height override
 * @param {number} [overrides.width] - Explicit width override
 * @param {number} [overrides.height] - Explicit height override
 * @param {string} [overrides.screenFamily] - Explicit screen family override
 * @param {string} [overrides.screenShape] - Explicit screen shape override ('round' or 'square')
 * @param {number} [overrides.deviceSource] - Explicit square-device source override used by family detection
 * @param {Object} [overrides.deviceInfo] - Explicit device info override
 * @returns {{width: number, height: number, isRound: boolean, safeTop: number, statusBarHeight: number, screenFamily: string, screenShape: string}} Screen metrics object
 *
 * @example
 * const { width, height, isRound, safeTop, screenFamily } = getScreenMetrics()
 * // width: 466, height: 466, screenFamily: 'w466-r', isRound: true
 * // width: 390, height: 450, screenFamily: 'w390-s', isRound: false
 */
export function getScreenMetrics(overrides = {}) {
  const normalizedOverrides = normalizeMetricOverrides(overrides)
  const deviceInfo = resolveDeviceInfo(normalizedOverrides.deviceInfo)
  const width = ensureNumber(
    normalizedOverrides.width ?? deviceInfo?.width,
    390
  )
  const height = ensureNumber(
    normalizedOverrides.height ?? deviceInfo?.height,
    450
  )
  const screenShape = resolveScreenShape(
    normalizedOverrides.screenShape ?? deviceInfo?.screenShape,
    width,
    height
  )
  const screenFamily = resolveScreenFamily({
    explicitScreenFamily: normalizedOverrides.screenFamily,
    reportedScreenFamily:
      deviceInfo?.screenFamily ?? deviceInfo?.screen_family ?? deviceInfo?.sr,
    width,
    height,
    screenShape,
    deviceSource: normalizedOverrides.deviceSource ?? deviceInfo?.deviceSource
  })
  const screenFamilyConfig = SCREEN_FAMILY_CONFIGS[screenFamily]
  const statusBarHeight = resolveStatusBarHeight({
    height,
    statusBarHeightOverride: normalizedOverrides.statusBarHeight,
    defaultStatusBarHeight: screenFamilyConfig?.statusBarHeight ?? 0
  })

  return {
    width,
    height,
    isRound: screenShape === 'round',
    screenFamily,
    screenShape,
    statusBarHeight,
    safeTop: resolveSafeTop({
      height,
      safeTopOverride: normalizedOverrides.safeTop,
      statusBarHeight
    })
  }
}

/**
 * Returns the detected status bar height for the current family.
 * Square `w390-s` reserves a fixed 48px top inset; supported round families reserve 0.
 *
 * @param {Object|number} [overrides={}] - Optional metrics overrides for testing
 * @returns {number} Detected status bar height in pixels
 */
export function getStatusBarHeight(overrides = {}) {
  return getScreenMetrics(overrides).statusBarHeight
}

function normalizeMetricOverrides(overrides) {
  if (typeof overrides === 'number') {
    return { safeTop: overrides }
  }

  if (!overrides || typeof overrides !== 'object') {
    return {}
  }

  return overrides
}

function resolveDeviceInfo(overrideDeviceInfo) {
  if (overrideDeviceInfo && typeof overrideDeviceInfo === 'object') {
    return overrideDeviceInfo
  }

  if (
    typeof hmSetting === 'undefined' ||
    typeof hmSetting.getDeviceInfo !== 'function'
  ) {
    return null
  }

  try {
    return hmSetting.getDeviceInfo() ?? null
  } catch {
    return null
  }
}

function resolveSafeTop({ height, safeTopOverride, statusBarHeight }) {
  if (typeof safeTopOverride === 'number' && !Number.isNaN(safeTopOverride)) {
    return clamp(Math.round(safeTopOverride), 0, height)
  }

  return clamp(statusBarHeight, 0, height)
}

function resolveStatusBarHeight({
  height,
  statusBarHeightOverride,
  defaultStatusBarHeight
}) {
  if (
    typeof statusBarHeightOverride === 'number' &&
    !Number.isNaN(statusBarHeightOverride)
  ) {
    return clamp(Math.round(statusBarHeightOverride), 0, height)
  }

  return clamp(defaultStatusBarHeight, 0, height)
}

function resolveScreenFamily({
  explicitScreenFamily,
  reportedScreenFamily,
  width,
  height,
  screenShape,
  deviceSource
}) {
  const supportedExplicitFamily = normalizeScreenFamily(
    explicitScreenFamily,
    screenShape
  )
  if (supportedExplicitFamily) {
    return supportedExplicitFamily
  }

  const supportedReportedFamily = normalizeScreenFamily(
    reportedScreenFamily,
    screenShape
  )
  if (supportedReportedFamily) {
    return supportedReportedFamily
  }

  const matchedFamily = matchScreenFamilyByDimensions(
    width,
    height,
    screenShape
  )
  if (matchedFamily) {
    return matchedFamily
  }

  if (
    screenShape === 'square' &&
    SQUARE_DEVICE_SOURCES.has(Number(deviceSource)) &&
    isWithinScreenFamilyTolerance(SCREEN_FAMILY_W390_S, width, height)
  ) {
    return SCREEN_FAMILY_W390_S
  }

  return SCREEN_FAMILY_UNKNOWN
}

function normalizeScreenFamily(screenFamily, screenShape) {
  if (typeof screenFamily !== 'string') {
    return null
  }

  const normalizedFamily = screenFamily.trim().toLowerCase()

  if (SUPPORTED_SCREEN_FAMILIES.includes(normalizedFamily)) {
    return normalizedFamily
  }

  const widthOnlyMatch = normalizedFamily.match(/^w(\d{3})$/)
  if (!widthOnlyMatch) {
    return null
  }

  const normalizedShape = screenShape === 'round' ? 'r' : 's'
  const derivedFamily = `w${widthOnlyMatch[1]}-${normalizedShape}`

  return SUPPORTED_SCREEN_FAMILIES.includes(derivedFamily)
    ? derivedFamily
    : null
}

function matchScreenFamilyByDimensions(width, height, screenShape) {
  return (
    SUPPORTED_SCREEN_FAMILIES.find((screenFamily) => {
      const config = SCREEN_FAMILY_CONFIGS[screenFamily]

      return (
        config.screenShape === screenShape &&
        isWithinScreenFamilyTolerance(screenFamily, width, height)
      )
    }) ?? null
  )
}

function isWithinScreenFamilyTolerance(screenFamily, width, height) {
  const config = SCREEN_FAMILY_CONFIGS[screenFamily]
  if (!config) {
    return false
  }

  return (
    Math.abs(width - config.width) <= SCREEN_DIMENSION_TOLERANCE &&
    Math.abs(height - config.height) <= SCREEN_DIMENSION_TOLERANCE
  )
}

export function resolveScreenShape(screenShape, width, height) {
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

/**
 * Constrains a value within a specified range.
 *
 * @param {number} value - The value to constrain
 * @param {number} min - The minimum allowed value
 * @param {number} max - The maximum allowed value
 * @returns {number} The constrained value
 *
 * @example
 * clamp(150, 0, 100)  // Returns 100
 * clamp(-10, 0, 100)  // Returns 0
 * clamp(50, 0, 100)   // Returns 50
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Validates that a value is a valid number, returning a fallback if not.
 *
 * @param {*} value - The value to validate
 * @param {number} [fallback=0] - The fallback value if invalid (defaults to 0)
 * @returns {number} The validated number or fallback
 *
 * @example
 * ensureNumber(42)         // Returns 42
 * ensureNumber('invalid')  // Returns 0
 * ensureNumber(null, 10)   // Returns 10
 * ensureNumber(NaN, 5)     // Returns 5
 */
export function ensureNumber(value, fallback = 0) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

/**
 * Converts a percentage to pixels based on a screen dimension.
 * Handles both 0-1 (decimal) and 0-100 (percentage) formats.
 *
 * @param {number} screenDimension - The base dimension (width or height)
 * @param {number} percentage - The percentage value (0-1 or 0-100)
 * @returns {number} The calculated pixel value
 *
 * @example
 * pct(400, 0.1)   // Returns 40 (decimal format)
 * pct(400, 10)    // Returns 40 (percentage format)
 * pct(400, 50)    // Returns 200
 */
export function pct(screenDimension, percentage) {
  // Handle both 0-1 and 0-100 formats
  const normalizedPercentage = percentage > 1 ? percentage / 100 : percentage
  return screenDimension * normalizedPercentage
}

/**
 * Calculates the safe inset for round screens at a specific Y position.
 * Uses circle geometry to find the chord at the given Y position.
 *
 * Algorithm:
 * - centerX = width / 2
 * - radius = width / 2
 * - yFromCenter = y - (height / 2)
 * - halfChord = Math.sqrt(radius * radius - yFromCenter * yFromCenter)
 * - Return Math.max(0, centerX - halfChord + padding)
 *
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @param {number} y - The Y position to calculate inset for
 * @param {number} [padding=4] - Additional padding from edge (default: 4)
 * @returns {number} The safe inset value from the left edge
 *
 * @example
 * // For a 466x466 round screen at y=233 (center)
 * getRoundSafeInset(466, 466, 233, 4)  // Returns 4 (minimum at center)
 *
 * // At y=0 (top edge)
 * getRoundSafeInset(466, 466, 0, 4)    // Returns ~237 (large inset at edge)
 */
function getRoundSafeInset(width, height, y, padding = 4) {
  const centerX = width / 2
  const radius = width / 2
  const yFromCenter = y - height / 2
  const halfChord = Math.sqrt(radius * radius - yFromCenter * yFromCenter)
  return Math.max(0, centerX - halfChord + padding)
}

/**
 * Calculates the safe inset for an entire section on round screens.
 * Computes insets for both top and bottom of section, returns the maximum.
 *
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @param {number} sectionTop - The Y position of section top
 * @param {number} sectionHeight - The height of the section
 * @param {number} [padding=4] - Additional padding from edge (default: 4)
 * @returns {number} The maximum safe inset value for the entire section
 *
 * @example
 * // For a section spanning y=100 to y=200 on a 466x466 screen
 * getRoundSafeSectionInset(466, 466, 100, 100, 4)
 * // Returns max of insets at y=100 and y=200
 */
export function getRoundSafeSectionInset(
  width,
  height,
  sectionTop,
  sectionHeight,
  padding = 4
) {
  const sectionBottom = sectionTop + sectionHeight
  const topInset = getRoundSafeInset(width, height, sectionTop, padding)
  const bottomInset = getRoundSafeInset(width, height, sectionBottom, padding)
  return Math.max(topInset, bottomInset)
}
