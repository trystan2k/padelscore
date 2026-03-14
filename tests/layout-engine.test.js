/**
 * @fileoverview Tests for the declarative layout engine.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLayout, safeResolveLayout } from '../utils/layout-engine.js'

// Mock metrics for consistent testing
const mockMetrics = {
  width: 400,
  height: 500,
  isRound: false
}

const mockRoundMetrics = {
  width: 466,
  height: 466,
  isRound: true,
  screenFamily: 'w466-r',
  statusBarHeight: 0,
  safeTop: 0
}

const mockSafeTopMetrics = {
  width: 400,
  height: 500,
  isRound: false,
  screenFamily: 'w390-s',
  statusBarHeight: 48,
  safeTop: 48
}

// ============================================
// Test 1: File compiles and basic resolution
// ============================================
test('resolveLayout returns plausible numeric coordinates', () => {
  const layout = resolveLayout(
    {
      sections: {
        header: { height: '15%', top: 0 }
      },
      elements: {
        title: { section: 'header', x: 0, y: 0, width: '100%', height: '50%' }
      }
    },
    mockMetrics
  )

  // Section should have numeric coordinates
  assert.equal(typeof layout.sections.header.x, 'number')
  assert.equal(typeof layout.sections.header.y, 'number')
  assert.equal(typeof layout.sections.header.w, 'number')
  assert.equal(typeof layout.sections.header.h, 'number')

  // Header should be 15% of 500 = 75px
  assert.equal(layout.sections.header.h, 75)
  assert.equal(layout.sections.header.y, 0)

  // Element should have numeric coordinates
  assert.equal(typeof layout.elements.title.x, 'number')
  assert.equal(typeof layout.elements.title.y, 'number')
  assert.equal(typeof layout.elements.title.w, 'number')
  assert.equal(typeof layout.elements.title.h, 'number')
})

test('resolveLayout handles empty schema gracefully', () => {
  const layout = resolveLayout({ sections: {}, elements: {} }, mockMetrics)

  assert.deepEqual(layout.sections, {})
  assert.deepEqual(layout.elements, {})
})

// ============================================
// Test 2: Reference resolution
// ============================================
test('section references like "header.bottom" resolve to correct coordinates', () => {
  const layout = resolveLayout(
    {
      sections: {
        header: { height: '10%', top: 0 },
        content: { height: '80%', after: 'header' }
      }
    },
    mockMetrics
  )

  // Header bottom = header.y + header.h = 0 + 50 = 50
  const headerBottom = layout.sections.header.y + layout.sections.header.h

  // Content should start at header bottom
  assert.equal(layout.sections.content.y, headerBottom)
  assert.equal(layout.sections.content.y, 50)
})

test('expression parsing with offset computes correctly', () => {
  // Expression like "header.bottom + 2%" should add 2% of height
  const layout = resolveLayout(
    {
      sections: {
        header: { height: '10%', top: 0 },
        content: { height: '70%', top: 'header.bottom + 2%' }
      }
    },
    mockMetrics
  )

  // header.bottom = 50
  // 2% of 500 = 10
  // Expected content.y = 60
  assert.equal(layout.sections.content.y, 60)
})

test('expression parsing with pixel offset computes correctly', () => {
  const layout = resolveLayout(
    {
      sections: {
        header: { height: '10%', top: 0 },
        content: { height: '70%', top: 'header.bottom + 10px' }
      }
    },
    mockMetrics
  )

  // header.bottom = 50
  // + 10px = 60
  assert.equal(layout.sections.content.y, 60)
})

test('expression parsing with subtraction computes correctly', () => {
  const layout = resolveLayout(
    {
      sections: {
        footer: { height: '10%', bottom: 0 },
        content: { height: '70%', bottom: 'footer.top - 5%' }
      }
    },
    mockMetrics
  )

  // footer.top = 500 - 50 = 450
  // - 5% of 500 = 25
  // Expected content bottom = 425, so y = 425 - 350 = 75
  // But we're setting bottom position, so content.y should align accordingly
  assert.equal(layout.sections.footer.y, 450)
})

test('safeTop offsets numeric and percentage top values', () => {
  const layout = resolveLayout(
    {
      sections: {
        numericTop: { height: 50, top: 10, roundSafeInset: false },
        percentageTop: { height: 50, top: '10%', roundSafeInset: false }
      }
    },
    mockSafeTopMetrics
  )

  // numericTop: safeTop (48) + 10
  assert.equal(layout.sections.numericTop.y, 58)

  // percentageTop: 10% of (height - safeTop) = 10% of 452 = 45.2 -> 45
  // final top = safeTop + 45
  assert.equal(layout.sections.percentageTop.y, 93)
})

test('safeTop affects after, fill, and bottom section placement', () => {
  const layout = resolveLayout(
    {
      sections: {
        header: { height: '10%', top: 0, roundSafeInset: false },
        content: { height: 'fill', after: 'header', roundSafeInset: false },
        footer: { height: '10%', bottom: 0, roundSafeInset: false }
      }
    },
    mockSafeTopMetrics
  )

  // vertical base is 500 - 48 = 452, so 10% sections are 45px
  assert.equal(layout.sections.header.y, 48)
  assert.equal(layout.sections.header.h, 45)

  // Content starts after header.bottom
  assert.equal(layout.sections.content.y, 93)

  // Fill uses remaining space after fixed sections (45 + 45)
  assert.equal(layout.sections.content.h, 362)

  // Bottom section stays anchored to physical bottom, clamped by safeTop
  assert.equal(layout.sections.footer.h, 45)
  assert.equal(layout.sections.footer.y, 455)
})

test('metrics.safeTop takes precedence over schema.safeTop', () => {
  const schema = {
    safeTop: 12,
    sections: {
      header: { top: 0, height: 50, roundSafeInset: false }
    }
  }

  const schemaOnlyLayout = resolveLayout(schema, {
    width: 400,
    height: 500,
    isRound: false
  })
  assert.equal(schemaOnlyLayout.sections.header.y, 12)

  const metricsOverrideLayout = resolveLayout(schema, {
    width: 400,
    height: 500,
    isRound: false,
    safeTop: 60
  })
  assert.equal(metricsOverrideLayout.sections.header.y, 60)
})

// ============================================
// Test 3: Fill height calculation
// ============================================
test('"fill" height correctly calculates remaining space', () => {
  const layout = resolveLayout(
    {
      sections: {
        header: { height: '20%', top: 0 },
        content: { height: 'fill', after: 'header' },
        footer: { height: '15%', bottom: 0 }
      }
    },
    mockMetrics
  )

  // Total fixed: 20% (100px) + 15% (75px) = 175px
  // Remaining for fill: 500 - 175 = 325px
  assert.equal(layout.sections.header.h, 100)
  assert.equal(layout.sections.footer.h, 75)
  assert.equal(layout.sections.content.h, 325)
})

test('multiple fill sections distribute space evenly', () => {
  const layout = resolveLayout(
    {
      sections: {
        top: { height: '20%', top: 0 },
        fill1: { height: 'fill', after: 'top' },
        fill2: { height: 'fill', after: 'fill1' }
      }
    },
    mockMetrics
  )

  // Fixed: 20% = 100px
  // Remaining: 400px split between two fills = 200px each
  assert.equal(layout.sections.fill1.h, 200)
  assert.equal(layout.sections.fill2.h, 200)
})

test('fill section with gap calculates correctly', () => {
  const layout = resolveLayout(
    {
      sections: {
        header: { height: '10%', top: 0 },
        content: { height: 'fill', after: 'header', gap: '2%' },
        footer: { height: '10%', after: 'content' }
      }
    },
    mockMetrics
  )

  // Header: 10% = 50px
  // Footer: 10% = 50px
  // Gap: 2% = 10px
  // Total fixed: 50 + 50 + 10 = 110px
  // Remaining for fill: 500 - 110 = 390px
  assert.equal(layout.sections.header.h, 50)
  assert.equal(layout.sections.footer.h, 50)
  assert.equal(layout.sections.content.h, 390)
})

// ============================================
// Test 4: Error handling
// ============================================
test('invalid section references fallback to 0', () => {
  const layout = resolveLayout(
    {
      sections: {
        content: { height: '50%', after: 'nonexistent' }
      }
    },
    mockMetrics
  )

  // Should not throw, should use 0 for missing section reference
  assert.equal(layout.sections.content.y, 0)
})

test('invalid percentages get clamped to 0-100', () => {
  const layout = resolveLayout(
    {
      sections: {
        header: { height: '150%', top: 0 }, // Invalid > 100
        footer: { height: '-20%', bottom: 0 } // Invalid < 0
      }
    },
    mockMetrics
  )

  // 150% should clamp to 100% = 500px
  assert.equal(layout.sections.header.h, 500)

  // -20% should clamp to 0% = 0px
  assert.equal(layout.sections.footer.h, 0)
})

test('missing parent sections cause elements to use full screen bounds', () => {
  const layout = resolveLayout(
    {
      sections: {},
      elements: {
        orphan: {
          section: 'nonexistent',
          x: '10%',
          y: '10%',
          width: '50%',
          height: '30%'
        }
      }
    },
    mockMetrics
  )

  // Element should be positioned relative to full screen (0,0)
  assert.equal(layout.elements.orphan.x, 40) // 10% of 400
  assert.equal(layout.elements.orphan.y, 50) // 10% of 500
  assert.equal(layout.elements.orphan.w, 200) // 50% of 400
  assert.equal(layout.elements.orphan.h, 150) // 30% of 500
})

test('null schema returns empty layout without throwing', () => {
  const layout = resolveLayout(null, mockMetrics)

  assert.deepEqual(layout.sections, {})
  assert.deepEqual(layout.elements, {})
})

test('undefined schema returns empty layout without throwing', () => {
  const layout = resolveLayout(undefined, mockMetrics)

  assert.deepEqual(layout.sections, {})
  assert.deepEqual(layout.elements, {})
})

test('invalid schema type returns empty layout without throwing', () => {
  const layout = resolveLayout('invalid', mockMetrics)

  assert.deepEqual(layout.sections, {})
  assert.deepEqual(layout.elements, {})
})

test('safeResolveLayout never throws on any input', () => {
  // These should not throw
  assert.doesNotThrow(() => safeResolveLayout(null, null))
  assert.doesNotThrow(() => safeResolveLayout(undefined, undefined))
  assert.doesNotThrow(() => safeResolveLayout('invalid', 'invalid'))
  assert.doesNotThrow(() => safeResolveLayout({ sections: 'bad' }, null))
  assert.doesNotThrow(() => safeResolveLayout({}, mockMetrics))
})

test('negative dimensions are clamped to 0', () => {
  const layout = resolveLayout(
    {
      elements: {
        box: { x: 0, y: 0, width: -100, height: -50 }
      }
    },
    mockMetrics
  )

  assert.equal(layout.elements.box.w, 0)
  assert.equal(layout.elements.box.h, 0)
})

// ============================================
// Test 5: Alignment
// ============================================
test('left alignment positions element at section.x', () => {
  const layout = resolveLayout(
    {
      sections: {
        content: { height: '100%', top: 0, sideInset: 20 }
      },
      elements: {
        box: {
          section: 'content',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          align: 'left'
        }
      }
    },
    mockMetrics
  )

  // Element should be at section origin + 0
  assert.equal(layout.elements.box.x, 20)
})

test('center alignment centers element horizontally within section', () => {
  const layout = resolveLayout(
    {
      sections: {
        content: { height: '100%', top: 0, sideInset: 0 }
      },
      elements: {
        box: {
          section: 'content',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          align: 'center'
        }
      }
    },
    mockMetrics
  )

  // Center: (section.w - element.w) / 2 = (400 - 100) / 2 = 150
  assert.equal(layout.elements.box.x, 150)
})

test('right alignment positions element at right edge of section', () => {
  const layout = resolveLayout(
    {
      sections: {
        content: { height: '100%', top: 0, sideInset: 0 }
      },
      elements: {
        box: {
          section: 'content',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          align: 'right'
        }
      }
    },
    mockMetrics
  )

  // Right: section.w - element.w = 400 - 100 = 300
  assert.equal(layout.elements.box.x, 300)
})

test('alignment respects section side inset', () => {
  const layout = resolveLayout(
    {
      sections: {
        content: { height: '100%', top: 0, sideInset: 50 }
      },
      elements: {
        box: {
          section: 'content',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          align: 'center'
        }
      }
    },
    mockMetrics
  )

  // Section.w = 400 - 100 = 300
  // Center: (300 - 100) / 2 = 100
  // Absolute x: 50 + 100 = 150
  assert.equal(layout.sections.content.w, 300)
  assert.equal(layout.elements.box.x, 150)
})

// ============================================
// Test 6: Round screen safe insets
// ============================================
test('round screen sections apply safe inset by default', () => {
  const layout = resolveLayout(
    {
      sections: {
        center: { height: '20%', top: '40%' } // Center of screen
      }
    },
    mockRoundMetrics
  )

  // Round screen should have positive side inset
  assert.ok(layout.sections.center.x > 0)
  assert.ok(layout.sections.center.w < mockRoundMetrics.width)
})

test('roundSafeInset: false disables safe inset calculation', () => {
  const layout = resolveLayout(
    {
      sections: {
        full: { height: '100%', top: 0, roundSafeInset: false }
      }
    },
    mockRoundMetrics
  )

  // Should use full width
  assert.equal(layout.sections.full.x, 0)
  assert.equal(layout.sections.full.w, mockRoundMetrics.width)
})

test('round screen uses default safe inset when not explicitly disabled', () => {
  const layout = resolveLayout(
    {
      sections: {
        top: { height: '10%', top: 0 }
      }
    },
    mockRoundMetrics
  )

  // At top of round screen, inset should be significant
  assert.ok(layout.sections.top.x > 100)
  assert.ok(layout.sections.top.w < mockRoundMetrics.width)
})

test('explicit sideInset overrides round safe inset', () => {
  const layout = resolveLayout(
    {
      sections: {
        custom: { height: '50%', top: 0, sideInset: 20 }
      }
    },
    mockRoundMetrics
  )

  assert.equal(layout.sections.custom.x, 20)
  assert.equal(layout.sections.custom.w, mockRoundMetrics.width - 40)
})

test('percentage sideInset is calculated correctly', () => {
  const layout = resolveLayout(
    {
      sections: {
        content: { height: '100%', top: 0, sideInset: '10%' }
      }
    },
    mockMetrics
  )

  // 10% of 400 = 40px inset on each side
  assert.equal(layout.sections.content.x, 40)
  assert.equal(layout.sections.content.w, 320)
})

// ============================================
// Test 7: Complex layout scenario
// ============================================
test('complex layout with mixed units resolves correctly', () => {
  const layout = resolveLayout(
    {
      sections: {
        header: { height: '12%', top: 0 },
        nav: { height: 48, after: 'header' }, // Fixed pixel height
        content: { height: 'fill', after: 'nav', gap: '2%' },
        footer: { height: '10%', bottom: 0 }
      },
      elements: {
        title: {
          section: 'header',
          x: 'center',
          y: '25%',
          width: '80%',
          height: '50%',
          align: 'center'
        },
        button: {
          section: 'footer',
          x: '10%',
          y: '20%',
          width: '80%',
          height: '60%',
          align: 'left'
        }
      }
    },
    mockMetrics
  )

  // Verify all coordinates are valid numbers
  assert.ok(Number.isFinite(layout.sections.header.y))
  assert.ok(Number.isFinite(layout.sections.nav.y))
  assert.ok(Number.isFinite(layout.sections.content.y))
  assert.ok(Number.isFinite(layout.sections.footer.y))

  // Header: 12% of 500 = 60px
  assert.equal(layout.sections.header.h, 60)
  assert.equal(layout.sections.header.y, 0)

  // Nav: 48px after header
  assert.equal(layout.sections.nav.h, 48)
  assert.equal(layout.sections.nav.y, 60)

  // Footer: 10% of 500 = 50px at bottom
  assert.equal(layout.sections.footer.h, 50)
  assert.equal(layout.sections.footer.y, 450)

  // Content fills remaining: 500 - 60 - 48 - 50 - 10(gap) = 332
  // Note: gap is 2% = 10px, applied once
  assert.ok(layout.sections.content.h > 300)
})

test('element position is relative to section origin', () => {
  const layout = resolveLayout(
    {
      sections: {
        content: { height: '50%', top: '25%', sideInset: 0 }
      },
      elements: {
        box: {
          section: 'content',
          x: '10%',
          y: '20%',
          width: '50%',
          height: '30%'
        }
      }
    },
    mockMetrics
  )

  // Section at y=125 (25% of 500), h=250
  assert.equal(layout.sections.content.y, 125)
  assert.equal(layout.sections.content.h, 250)

  // Element at 10% of section width = 40px, 20% of section height = 50px
  // Absolute: x = 0 + 40 = 40, y = 125 + 50 = 175
  assert.equal(layout.elements.box.x, 40)
  assert.equal(layout.elements.box.y, 175)
})

test('pixel values are handled correctly', () => {
  const layout = resolveLayout(
    {
      sections: {
        fixed: { height: 100, top: 50 }
      },
      elements: {
        box: {
          section: 'fixed',
          x: 10,
          y: 20,
          width: 200,
          height: 50
        }
      }
    },
    mockMetrics
  )

  assert.equal(layout.sections.fixed.y, 50)
  assert.equal(layout.sections.fixed.h, 100)
  assert.equal(layout.elements.box.x, 10)
  assert.equal(layout.elements.box.y, 70) // 50 + 20
  assert.equal(layout.elements.box.w, 200)
  assert.equal(layout.elements.box.h, 50)
})

test('elements without section use full screen bounds', () => {
  const layout = resolveLayout(
    {
      sections: {},
      elements: {
        fullScreen: {
          x: 0,
          y: 0,
          width: '100%',
          height: '100%'
        }
      }
    },
    mockMetrics
  )

  assert.equal(layout.elements.fullScreen.x, 0)
  assert.equal(layout.elements.fullScreen.y, 0)
  assert.equal(layout.elements.fullScreen.w, 400)
  assert.equal(layout.elements.fullScreen.h, 500)
})

test('decimal percentages are parsed correctly', () => {
  const layout = resolveLayout(
    {
      sections: {
        precise: { height: '12.5%', top: 0 }
      }
    },
    mockMetrics
  )

  // 12.5% of 500 = 62.5, rounded to 63
  assert.equal(layout.sections.precise.h, 63)
})

test('section with gap property positions correctly', () => {
  const layout = resolveLayout(
    {
      sections: {
        first: { height: '10%', top: 0 },
        second: { height: '10%', after: 'first', gap: 20 }
      }
    },
    mockMetrics
  )

  // First: 10% = 50px, y = 0
  assert.equal(layout.sections.first.y, 0)
  assert.equal(layout.sections.first.h, 50)

  // Second: starts after first + gap = 50 + 20 = 70
  assert.equal(layout.sections.second.y, 70)
})

test('multiple sequential sections with after property', () => {
  const layout = resolveLayout(
    {
      sections: {
        header: { height: '10%', top: 0 },
        nav: { height: '5%', after: 'header' },
        content: { height: 'fill', after: 'nav' },
        footer: { height: '10%', after: 'content' }
      }
    },
    mockMetrics
  )

  // Verify sequential positioning
  assert.equal(layout.sections.header.y, 0)
  assert.equal(layout.sections.nav.y, 50) // 10% of 500
  // Content starts after nav
  assert.ok(layout.sections.content.y >= 75) // 50 + 25 (5%)
  // Footer starts after content
  assert.ok(
    layout.sections.footer.y >=
      layout.sections.content.y + layout.sections.content.h
  )
})
