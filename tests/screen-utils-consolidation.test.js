/**
 * @fileoverview Tests for screen-utils consolidation (Task #63).
 *
 * Verifies that all duplicate screen metrics implementations have been
 * consolidated into utils/screen-utils.js and that imports work correctly.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

// ============================================
// Test 1: getScreenMetrics returns valid metrics
// ============================================
test('getScreenMetrics returns width, height, shape, and family metadata', async () => {
  const { getScreenMetrics } = await import('../utils/screen-utils.js')

  const metrics = getScreenMetrics()

  assert.ok(metrics, 'getScreenMetrics should return an object')
  assert.ok('width' in metrics, 'metrics should have width property')
  assert.ok('height' in metrics, 'metrics should have height property')
  assert.ok('isRound' in metrics, 'metrics should have isRound property')
  assert.ok(
    'screenShape' in metrics,
    'metrics should have screenShape property'
  )
  assert.ok(
    'screenFamily' in metrics,
    'metrics should have screenFamily property'
  )
  assert.ok(
    'statusBarHeight' in metrics,
    'metrics should have statusBarHeight property'
  )
  assert.ok('safeTop' in metrics, 'metrics should have safeTop property')
  assert.equal(typeof metrics.width, 'number', 'width should be a number')
  assert.equal(typeof metrics.height, 'number', 'height should be a number')
  assert.equal(typeof metrics.isRound, 'boolean', 'isRound should be a boolean')
  assert.equal(typeof metrics.screenShape, 'string')
  assert.equal(typeof metrics.screenFamily, 'string')
  assert.equal(typeof metrics.statusBarHeight, 'number')
  assert.equal(typeof metrics.safeTop, 'number', 'safeTop should be a number')
})

// ============================================
// Test 2: getScreenMetrics returns fallback values in test environment
// ============================================
test('getScreenMetrics returns fallback values when hmSetting is unavailable', async () => {
  const {
    getScreenMetrics,
    SCREEN_FAMILY_W390_S,
    SYSTEM_HEADER_HEIGHT_SQUARE
  } = await import('../utils/screen-utils.js')

  const metrics = getScreenMetrics()

  // In Node.js test environment, hmSetting is undefined, so we get defaults
  assert.equal(metrics.width, 390, 'should return default width 390')
  assert.equal(metrics.height, 450, 'should return default height 450')
  assert.equal(metrics.isRound, false, 'should return default isRound false')
  assert.equal(metrics.screenFamily, SCREEN_FAMILY_W390_S)
  assert.equal(metrics.statusBarHeight, SYSTEM_HEADER_HEIGHT_SQUARE)
  assert.equal(metrics.safeTop, SYSTEM_HEADER_HEIGHT_SQUARE)
})

test('getScreenMetrics safeTop override supports clamping and legacy number input', async () => {
  const { getScreenMetrics, SYSTEM_HEADER_HEIGHT_SQUARE } = await import(
    '../utils/screen-utils.js'
  )

  const clampedHigh = getScreenMetrics({ safeTop: 9999 })
  assert.equal(clampedHigh.safeTop, clampedHigh.height)
  assert.equal(clampedHigh.statusBarHeight, SYSTEM_HEADER_HEIGHT_SQUARE)

  const clampedLow = getScreenMetrics({ safeTop: -10 })
  assert.equal(clampedLow.safeTop, 0)

  const rounded = getScreenMetrics({ safeTop: 12.8 })
  assert.equal(rounded.safeTop, 13)

  const legacyNumber = getScreenMetrics(20)
  assert.equal(legacyNumber.safeTop, 20)
})

test('getScreenMetrics detects all supported screen families from runtime dimensions', async () => {
  const {
    getScreenMetrics,
    SCREEN_FAMILY_W390_S,
    SCREEN_FAMILY_W454_R,
    SCREEN_FAMILY_W466_R,
    SCREEN_FAMILY_W480_R,
    SYSTEM_HEADER_HEIGHT_SQUARE
  } = await import('../utils/screen-utils.js')
  const originalHmSetting = globalThis.hmSetting

  try {
    const scenarios = [
      {
        deviceInfo: { width: 390, height: 450, screenShape: 'square' },
        expectedFamily: SCREEN_FAMILY_W390_S,
        expectedSafeTop: SYSTEM_HEADER_HEIGHT_SQUARE,
        expectedStatusBarHeight: SYSTEM_HEADER_HEIGHT_SQUARE,
        expectedIsRound: false
      },
      {
        deviceInfo: { width: 454, height: 454, screenShape: 'round' },
        expectedFamily: SCREEN_FAMILY_W454_R,
        expectedSafeTop: 0,
        expectedStatusBarHeight: 0,
        expectedIsRound: true
      },
      {
        deviceInfo: { width: 466, height: 466, screenShape: 'round' },
        expectedFamily: SCREEN_FAMILY_W466_R,
        expectedSafeTop: 0,
        expectedStatusBarHeight: 0,
        expectedIsRound: true
      },
      {
        deviceInfo: { width: 480, height: 480, screenShape: 'round' },
        expectedFamily: SCREEN_FAMILY_W480_R,
        expectedSafeTop: 0,
        expectedStatusBarHeight: 0,
        expectedIsRound: true
      }
    ]

    scenarios.forEach((scenario) => {
      globalThis.hmSetting = {
        getDeviceInfo() {
          return scenario.deviceInfo
        }
      }

      const metrics = getScreenMetrics()
      assert.equal(metrics.screenFamily, scenario.expectedFamily)
      assert.equal(metrics.safeTop, scenario.expectedSafeTop)
      assert.equal(metrics.statusBarHeight, scenario.expectedStatusBarHeight)
      assert.equal(metrics.isRound, scenario.expectedIsRound)
    })
  } finally {
    if (originalHmSetting === undefined) {
      delete globalThis.hmSetting
    } else {
      globalThis.hmSetting = originalHmSetting
    }
  }
})

test('getStatusBarHeight follows family defaults and explicit overrides', async () => {
  const { getStatusBarHeight, SYSTEM_HEADER_HEIGHT_SQUARE } = await import(
    '../utils/screen-utils.js'
  )

  assert.equal(
    getStatusBarHeight({ width: 390, height: 450, screenShape: 'square' }),
    SYSTEM_HEADER_HEIGHT_SQUARE
  )
  assert.equal(
    getStatusBarHeight({ width: 454, height: 454, screenShape: 'round' }),
    0
  )
  assert.equal(
    getStatusBarHeight({
      width: 390,
      height: 450,
      screenShape: 'square',
      statusBarHeight: 24
    }),
    24
  )
})

test('getScreenMetrics does not force w390-s for square device sources with mismatched dimensions', async () => {
  const { getScreenMetrics, SCREEN_FAMILY_UNKNOWN } = await import(
    '../utils/screen-utils.js'
  )

  const metrics = getScreenMetrics({
    width: 400,
    height: 400,
    screenShape: 'square',
    deviceSource: 224
  })

  assert.equal(metrics.screenFamily, SCREEN_FAMILY_UNKNOWN)
  assert.equal(metrics.statusBarHeight, 0)
  assert.equal(metrics.safeTop, 0)
})

// ============================================
// Test 3: ensureNumber handles various inputs
// ============================================
test('ensureNumber returns fallback for invalid values', async () => {
  const { ensureNumber } = await import('../utils/screen-utils.js')

  assert.equal(ensureNumber(null, 100), 100, 'null should return fallback')
  assert.equal(
    ensureNumber(undefined, 100),
    100,
    'undefined should return fallback'
  )
  assert.equal(ensureNumber(NaN, 100), 100, 'NaN should return fallback')
  assert.equal(
    ensureNumber('invalid', 100),
    100,
    'string should return fallback'
  )
  assert.equal(ensureNumber({}, 100), 100, 'object should return fallback')
  assert.equal(
    ensureNumber(50, 100),
    50,
    'valid number should return the number'
  )
  assert.equal(ensureNumber(0, 100), 0, 'zero is a valid number')
  assert.equal(ensureNumber(-5, 100), -5, 'negative numbers are valid')
})

// ============================================
// Test 4: ensureNumber default fallback
// ============================================
test('ensureNumber uses 0 as default fallback', async () => {
  const { ensureNumber } = await import('../utils/screen-utils.js')

  assert.equal(
    ensureNumber(null),
    0,
    'should default to 0 when no fallback provided'
  )
  assert.equal(
    ensureNumber(undefined),
    0,
    'should default to 0 when no fallback provided'
  )
})

// ============================================
// Test 5: clamp constrains values correctly
// ============================================
test('clamp constrains values within range', async () => {
  const { clamp } = await import('../utils/screen-utils.js')

  assert.equal(clamp(50, 0, 100), 50, 'value within range should be unchanged')
  assert.equal(
    clamp(150, 0, 100),
    100,
    'value above max should be clamped to max'
  )
  assert.equal(
    clamp(-10, 0, 100),
    0,
    'value below min should be clamped to min'
  )
  assert.equal(clamp(0, 0, 100), 0, 'value at min should be unchanged')
  assert.equal(clamp(100, 0, 100), 100, 'value at max should be unchanged')
})

// ============================================
// Test 6: pct converts percentages correctly
// ============================================
test('pct converts percentages to pixels', async () => {
  const { pct } = await import('../utils/screen-utils.js')

  // Decimal format (0-1)
  assert.equal(pct(400, 0.1), 40, '10% of 400 should be 40')
  assert.equal(pct(400, 0.5), 200, '50% of 400 should be 200')

  // Percentage format (0-100)
  assert.equal(pct(400, 10), 40, '10% of 400 should be 40')
  assert.equal(pct(400, 50), 200, '50% of 400 should be 200')
})

// ============================================
// Test 7: ui-components imports getScreenMetrics
// ============================================
test('ui-components can import getScreenMetrics from screen-utils', async () => {
  // This test verifies the import path is correct
  const uiComponents = await import('../utils/ui-components.js')

  // The module should export the component factories
  assert.ok(uiComponents.createBackground, 'should export createBackground')
  assert.ok(uiComponents.createDivider, 'should export createDivider')
  assert.ok(uiComponents.createText, 'should export createText')
  assert.ok(uiComponents.createButton, 'should export createButton')
})

// ============================================
// Test 8: design-tokens imports getScreenMetrics
// ============================================
test('design-tokens can import getScreenMetrics from screen-utils', async () => {
  const designTokens = await import('../utils/design-tokens.js')

  // The module should export TOKENS and getFontSize
  assert.ok(designTokens.TOKENS, 'should export TOKENS')
  assert.ok(designTokens.getFontSize, 'should export getFontSize')
  assert.ok(designTokens.getColor, 'should export getColor')
})

// ============================================
// Test 9: getFontSize uses centralized getScreenMetrics
// ============================================
test('getFontSize returns valid font sizes', async () => {
  const { getFontSize, TOKENS } = await import('../utils/design-tokens.js')

  // Test all typography tokens
  for (const key of Object.keys(TOKENS.typography)) {
    const fontSize = getFontSize(key)
    assert.equal(typeof fontSize, 'number', `${key} should return a number`)
    assert.ok(fontSize > 0, `${key} should return positive font size`)
  }
})

// ============================================
// Test 10: Verify no duplicate implementations
// ============================================
test('no duplicate getScreenDimensions in ui-components', async () => {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')

  const uiComponentsPath = path.join(process.cwd(), 'utils/ui-components.js')
  const content = await fs.readFile(uiComponentsPath, 'utf-8')

  // Should NOT contain local getScreenDimensions function
  assert.ok(
    !content.includes('function getScreenDimensions'),
    'should not have local getScreenDimensions function'
  )

  // Should import from screen-utils
  assert.ok(
    content.includes("from './screen-utils.js'"),
    'should import from screen-utils.js'
  )
})

test('no duplicate ensureNumber in design-tokens', async () => {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')

  const designTokensPath = path.join(process.cwd(), 'utils/design-tokens.js')
  const content = await fs.readFile(designTokensPath, 'utf-8')

  // Should NOT contain local ensureNumber function
  assert.ok(
    !content.includes('function ensureNumber'),
    'should not have local ensureNumber function'
  )

  // Should import from screen-utils
  assert.ok(
    content.includes("from './screen-utils.js'"),
    'should import from screen-utils.js'
  )
})

test('platform-adapters reuses resolveScreenShape from screen-utils', async () => {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')

  const platformAdaptersPath = path.join(
    process.cwd(),
    'utils/platform-adapters.js'
  )
  const content = await fs.readFile(platformAdaptersPath, 'utf-8')

  assert.ok(
    content.includes('resolveScreenShape'),
    'platform-adapters should reference resolveScreenShape'
  )
  assert.match(
    content,
    /from '\.\/screen-utils\.js'/,
    'platform-adapters should import from screen-utils.js'
  )
  assert.ok(
    !content.includes('function resolveScreenShape('),
    'platform-adapters should not define a duplicate resolveScreenShape helper'
  )
})

test('no duplicate getScreenMetrics method in game.js', async () => {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')

  const gamePath = path.join(process.cwd(), 'page/game.js')
  const content = await fs.readFile(gamePath, 'utf-8')

  // Should NOT contain local getScreenMetrics method (method notation: getScreenMetrics() {)
  assert.ok(
    !content.includes('getScreenMetrics() {'),
    'should not have local getScreenMetrics method'
  )

  // Should import from screen-utils
  assert.ok(
    content.includes("from '../utils/screen-utils.js'"),
    'should import from screen-utils.js'
  )
})
