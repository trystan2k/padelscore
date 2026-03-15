import { describe, expect, it } from 'vitest'
import {
  clamp,
  ensureNumber,
  getRoundSafeSectionInset,
  getScreenMetrics,
  getStatusBarHeight,
  pct,
  resolveScreenShape
} from '../../utils/screen-utils.js'

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(50, 0, 100)).toBe(50)
    expect(clamp(0, 0, 100)).toBe(0)
    expect(clamp(100, 0, 100)).toBe(100)
  })

  it('returns max when value exceeds range', () => {
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(999, 0, 100)).toBe(100)
  })

  it('returns min when value is below range', () => {
    expect(clamp(-50, 0, 100)).toBe(0)
    expect(clamp(-999, 0, 100)).toBe(0)
  })

  it('handles negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5)
    expect(clamp(-15, -10, -1)).toBe(-10)
    expect(clamp(0, -10, -1)).toBe(-1)
  })

  it('handles same min and max', () => {
    expect(clamp(50, 10, 10)).toBe(10)
    expect(clamp(5, 10, 10)).toBe(10)
  })
})

describe('ensureNumber', () => {
  it('returns value for valid numbers', () => {
    expect(ensureNumber(42)).toBe(42)
    expect(ensureNumber(0)).toBe(0)
    expect(ensureNumber(-5)).toBe(-5)
    expect(ensureNumber(3.14)).toBe(3.14)
  })

  it('returns default fallback (0) for invalid values', () => {
    expect(ensureNumber(NaN)).toBe(0)
    expect(ensureNumber('string')).toBe(0)
    expect(ensureNumber(null)).toBe(0)
    expect(ensureNumber(undefined)).toBe(0)
    expect(ensureNumber({})).toBe(0)
    expect(ensureNumber([])).toBe(0)
  })

  it('returns custom fallback for invalid values', () => {
    expect(ensureNumber(NaN, 99)).toBe(99)
    expect(ensureNumber('string', 50)).toBe(50)
    expect(ensureNumber(null, -1)).toBe(-1)
  })

  it('does not accept Infinity as valid', () => {
    expect(ensureNumber(Infinity)).toBe(Infinity)
    expect(ensureNumber(-Infinity)).toBe(-Infinity)
  })
})

describe('pct', () => {
  it('calculates percentage in decimal format (0-1)', () => {
    expect(pct(400, 0)).toBe(0)
    expect(pct(400, 0.1)).toBe(40)
    expect(pct(400, 0.5)).toBe(200)
    expect(pct(400, 1)).toBe(400)
  })

  it('calculates percentage in percentage format (0-100)', () => {
    expect(pct(400, 0)).toBe(0)
    expect(pct(400, 10)).toBe(40)
    expect(pct(400, 50)).toBe(200)
    expect(pct(400, 100)).toBe(400)
  })

  it('handles edge cases', () => {
    expect(pct(100, 0.25)).toBe(25)
    expect(pct(100, 25)).toBe(25)
    expect(pct(200, 0.15)).toBe(30)
    expect(pct(200, 15)).toBe(30)
  })
})

describe('resolveScreenShape', () => {
  it('returns "round" for explicit round shape', () => {
    expect(resolveScreenShape('round', 466, 466)).toBe('round')
    expect(resolveScreenShape('ROUND', 466, 466)).toBe('round')
    expect(resolveScreenShape('  Round  ', 466, 466)).toBe('round')
  })

  it('returns "square" for explicit square shape', () => {
    expect(resolveScreenShape('square', 390, 450)).toBe('square')
    expect(resolveScreenShape('SQUARE', 390, 450)).toBe('square')
    expect(resolveScreenShape('  Square  ', 390, 450)).toBe('square')
  })

  it('handles shorthand "r" and "s"', () => {
    expect(resolveScreenShape('r', 466, 466)).toBe('round')
    expect(resolveScreenShape('R', 466, 466)).toBe('round')
    expect(resolveScreenShape('s', 390, 450)).toBe('square')
    expect(resolveScreenShape('S', 390, 450)).toBe('square')
  })

  it('infers round from equal dimensions', () => {
    expect(resolveScreenShape(undefined, 466, 466)).toBe('round')
    expect(resolveScreenShape(undefined, 454, 454)).toBe('round')
    expect(resolveScreenShape(null, 480, 480)).toBe('round')
  })

  it('infers square from unequal dimensions', () => {
    expect(resolveScreenShape(undefined, 390, 450)).toBe('square')
    expect(resolveScreenShape(undefined, 200, 300)).toBe('square')
  })

  it('infers round when dimensions are close enough (within 4% tolerance)', () => {
    expect(resolveScreenShape(undefined, 400, 416)).toBe('round')
    expect(resolveScreenShape(undefined, 100, 104)).toBe('round')
  })

  it('infers square when dimensions differ more than 4%', () => {
    expect(resolveScreenShape(undefined, 400, 420)).toBe('square')
    expect(resolveScreenShape(undefined, 100, 110)).toBe('square')
  })

  it('ignores invalid shape strings', () => {
    expect(resolveScreenShape('invalid', 390, 450)).toBe('square')
    expect(resolveScreenShape('', 466, 466)).toBe('round')
    expect(resolveScreenShape('unknown', 466, 466)).toBe('round')
  })
})

describe('getScreenMetrics', () => {
  it('returns default metrics when no overrides provided', () => {
    const metrics = getScreenMetrics({ deviceInfo: {} })
    expect(metrics.width).toBe(390)
    expect(metrics.height).toBe(450)
    expect(typeof metrics.isRound).toBe('boolean')
    expect(typeof metrics.screenFamily).toBe('string')
    expect(typeof metrics.statusBarHeight).toBe('number')
    expect(typeof metrics.safeTop).toBe('number')
  })

  it('accepts width and height overrides', () => {
    const metrics = getScreenMetrics({
      width: 466,
      height: 466,
      deviceInfo: {}
    })
    expect(metrics.width).toBe(466)
    expect(metrics.height).toBe(466)
    expect(metrics.isRound).toBe(true)
    expect(metrics.screenShape).toBe('round')
  })

  it('detects round screen from equal dimensions', () => {
    const metrics = getScreenMetrics({
      width: 454,
      height: 454,
      deviceInfo: {}
    })
    expect(metrics.isRound).toBe(true)
    expect(metrics.screenShape).toBe('round')
  })

  it('detects square screen from unequal dimensions', () => {
    const metrics = getScreenMetrics({
      width: 390,
      height: 450,
      deviceInfo: {}
    })
    expect(metrics.isRound).toBe(false)
    expect(metrics.screenShape).toBe('square')
  })

  it('resolves screen family from dimensions', () => {
    const w390 = getScreenMetrics({ width: 390, height: 450, deviceInfo: {} })
    expect(w390.screenFamily).toBe('w390-s')

    const w454 = getScreenMetrics({ width: 454, height: 454, deviceInfo: {} })
    expect(w454.screenFamily).toBe('w454-r')

    const w466 = getScreenMetrics({ width: 466, height: 466, deviceInfo: {} })
    expect(w466.screenFamily).toBe('w466-r')

    const w480 = getScreenMetrics({ width: 480, height: 480, deviceInfo: {} })
    expect(w480.screenFamily).toBe('w480-r')
  })

  it('accepts explicit screenFamily override', () => {
    const metrics = getScreenMetrics({
      width: 400,
      height: 400,
      screenFamily: 'w466-r',
      deviceInfo: {}
    })
    expect(metrics.screenFamily).toBe('w466-r')
  })

  it('accepts explicit screenShape override', () => {
    const roundMetrics = getScreenMetrics({
      width: 390,
      height: 450,
      screenShape: 'round',
      deviceInfo: {}
    })
    expect(roundMetrics.isRound).toBe(true)

    const squareMetrics = getScreenMetrics({
      width: 466,
      height: 466,
      screenShape: 'square',
      deviceInfo: {}
    })
    expect(squareMetrics.isRound).toBe(false)
  })

  it('accepts safeTop override', () => {
    const metrics = getScreenMetrics({
      width: 466,
      height: 466,
      safeTop: 20,
      deviceInfo: {}
    })
    expect(metrics.safeTop).toBe(20)
  })

  it('accepts statusBarHeight override', () => {
    const metrics = getScreenMetrics({
      width: 390,
      height: 450,
      statusBarHeight: 60,
      deviceInfo: {}
    })
    expect(metrics.statusBarHeight).toBe(60)
  })

  it('returns 0 statusBarHeight for round screens', () => {
    const metrics = getScreenMetrics({
      width: 466,
      height: 466,
      deviceInfo: {}
    })
    expect(metrics.statusBarHeight).toBe(0)
  })

  it('returns 48 statusBarHeight for w390-s square screen', () => {
    const metrics = getScreenMetrics({
      width: 390,
      height: 450,
      deviceInfo: {}
    })
    expect(metrics.statusBarHeight).toBe(48)
  })

  it('returns "unknown" for unrecognized dimensions', () => {
    const metrics = getScreenMetrics({
      width: 500,
      height: 600,
      deviceInfo: {}
    })
    expect(metrics.screenFamily).toBe('unknown')
  })

  it('accepts deviceInfo override', () => {
    const metrics = getScreenMetrics({
      deviceInfo: { width: 454, height: 454, screenShape: 'round' }
    })
    expect(metrics.width).toBe(454)
    expect(metrics.height).toBe(454)
    expect(metrics.isRound).toBe(true)
  })

  it('accepts numeric shorthand for safeTop', () => {
    const metrics = getScreenMetrics(25)
    expect(metrics.safeTop).toBe(25)
  })
})

describe('getStatusBarHeight', () => {
  it('returns 0 for round screens', () => {
    expect(
      getStatusBarHeight({ width: 466, height: 466, deviceInfo: {} })
    ).toBe(0)
    expect(
      getStatusBarHeight({ width: 454, height: 454, deviceInfo: {} })
    ).toBe(0)
  })

  it('returns 48 for w390-s square screen', () => {
    expect(
      getStatusBarHeight({ width: 390, height: 450, deviceInfo: {} })
    ).toBe(48)
  })

  it('accepts override', () => {
    expect(
      getStatusBarHeight({
        width: 466,
        height: 466,
        statusBarHeight: 10,
        deviceInfo: {}
      })
    ).toBe(10)
  })
})

describe('getRoundSafeSectionInset', () => {
  it('returns minimum inset at center of round screen', () => {
    const inset = getRoundSafeSectionInset(466, 466, 233, 0, 4)
    expect(inset).toBe(4)
  })

  it('returns larger inset near edges of round screen', () => {
    const topInset = getRoundSafeSectionInset(466, 466, 0, 0, 4)
    const centerInset = getRoundSafeSectionInset(466, 466, 233, 0, 4)
    expect(topInset).toBeGreaterThan(centerInset)
  })

  it('uses maximum of top and bottom inset for section', () => {
    const inset = getRoundSafeSectionInset(466, 466, 0, 466, 4)
    expect(inset).toBeGreaterThan(4)
  })

  it('accepts custom padding', () => {
    const inset = getRoundSafeSectionInset(466, 466, 233, 0, 10)
    expect(inset).toBe(10)
  })

  it('handles section at various Y positions', () => {
    const inset100 = getRoundSafeSectionInset(466, 466, 100, 50, 4)
    const inset200 = getRoundSafeSectionInset(466, 466, 200, 50, 4)
    expect(inset100).toBeGreaterThan(0)
    expect(inset200).toBeGreaterThan(0)
  })
})
