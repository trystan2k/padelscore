/**
 * @fileoverview Tests for layout preset factory functions.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { TOKENS } from '../utils/design-tokens.js'
import { resolveLayout } from '../utils/layout-engine.js'
import {
  createPageWithFooterButton,
  createScorePageLayout,
  createStandardPageLayout,
  createTwoColumnLayout
} from '../utils/layout-presets.js'

// Mock metrics for consistent testing
const mockMetrics = {
  width: 400,
  height: 500,
  isRound: false
}

const mockRoundMetrics = {
  width: 466,
  height: 466,
  isRound: true
}

// ============================================
// Test 1: Syntax Verification
// ============================================
test('layout-presets module exports all factory functions', () => {
  assert.equal(typeof createStandardPageLayout, 'function')
  assert.equal(typeof createPageWithFooterButton, 'function')
  assert.equal(typeof createScorePageLayout, 'function')
  assert.equal(typeof createTwoColumnLayout, 'function')
})

test('imports TOKENS from design-tokens correctly', () => {
  // Verify TOKENS is available
  assert.ok(TOKENS.spacing)
  assert.ok(TOKENS.typography)
  assert.ok(TOKENS.spacing.pageTop)
  assert.ok(TOKENS.typography.pageTitle)
})

// ============================================
// Test 2: createStandardPageLayout Schema Structure
// ============================================
test('createStandardPageLayout() returns sections: header, body, footer', () => {
  const schema = createStandardPageLayout()

  assert.ok(schema.sections)
  assert.ok(schema.sections.header)
  assert.ok(schema.sections.body)
  assert.ok(schema.sections.footer)
  assert.ok(schema.elements)
})

test('createStandardPageLayout({hasHeader:false}) excludes header', () => {
  const schema = createStandardPageLayout({ hasHeader: false })

  assert.equal(schema.sections.header, undefined)
  assert.ok(schema.sections.body)
  assert.ok(schema.sections.footer)
  // Body should not have 'after' property when no header
  assert.equal(schema.sections.body.after, undefined)
})

test('createStandardPageLayout({hasFooter:false}) excludes footer', () => {
  const schema = createStandardPageLayout({ hasFooter: false })

  assert.ok(schema.sections.header)
  assert.ok(schema.sections.body)
  assert.equal(schema.sections.footer, undefined)
})

test('createStandardPageLayout({hasHeader:false, hasFooter:false}) returns only body', () => {
  const schema = createStandardPageLayout({
    hasHeader: false,
    hasFooter: false
  })

  assert.equal(schema.sections.header, undefined)
  assert.ok(schema.sections.body)
  assert.equal(schema.sections.footer, undefined)
})

// ============================================
// Test 3: Section Properties
// ============================================
test('header section has correct default properties', () => {
  const schema = createStandardPageLayout()
  const header = schema.sections.header

  assert.equal(header.top, 0)
  assert.ok(header.height !== undefined)
  assert.equal(header.roundSafeInset, true)
})

test('body section has fill height and gap', () => {
  const schema = createStandardPageLayout()
  const body = schema.sections.body

  assert.equal(body.height, 'fill')
  assert.equal(body.after, 'header')
  assert.equal(body.gap, `${TOKENS.spacing.headerToContent * 100}%`)
  assert.equal(body.roundSafeInset, true)
})

test('footer section has roundSafeInset=false for icon centering', () => {
  const schema = createStandardPageLayout()
  const footer = schema.sections.footer

  assert.equal(footer.roundSafeInset, false)
})

test('body section without header has no after or gap', () => {
  const schema = createStandardPageLayout({ hasHeader: false })
  const body = schema.sections.body

  assert.equal(body.after, undefined)
  assert.equal(body.gap, undefined)
  assert.equal(body.height, 'fill')
  assert.equal(body.roundSafeInset, true)
})

// ============================================
// Test 4: createPageWithFooterButton Tests
// ============================================
test('createPageWithFooterButton() includes standard sections', () => {
  const schema = createPageWithFooterButton()

  assert.ok(schema.sections.header)
  assert.ok(schema.sections.body)
  assert.ok(schema.sections.footer)
})

test('createPageWithFooterButton() includes footerButton element', () => {
  const schema = createPageWithFooterButton()

  assert.ok(schema.elements.footerButton)
  assert.equal(schema.elements.footerButton.section, 'footer')
  assert.equal(schema.elements.footerButton.align, 'center')
})

test('createPageWithFooterButton() has default home icon', () => {
  const schema = createPageWithFooterButton()

  assert.ok(schema.elements.footerButton._meta)
  assert.equal(schema.elements.footerButton._meta.icon, 'home-icon.png')
})

test('createPageWithFooterButton({icon:"custom.png"}) uses custom icon', () => {
  const schema = createPageWithFooterButton({ icon: 'custom.png' })

  assert.equal(schema.elements.footerButton._meta.icon, 'custom.png')
})

test('createPageWithFooterButton respects hasHeader option', () => {
  const schema = createPageWithFooterButton({ hasHeader: false })

  assert.equal(schema.sections.header, undefined)
  assert.ok(schema.sections.footer)
  assert.ok(schema.elements.footerButton)
})

test('footerButton has correct size from TOKENS', () => {
  const schema = createPageWithFooterButton()
  const button = schema.elements.footerButton

  assert.equal(button.width, TOKENS.sizing.iconLarge)
  assert.equal(button.height, TOKENS.sizing.iconLarge)
})

test('footerButton stores onClick in _meta', () => {
  const clickHandler = () => {}
  const schema = createPageWithFooterButton({ onClick: clickHandler })

  assert.equal(schema.elements.footerButton._meta.onClick, clickHandler)
})

// ============================================
// Test 5: createTwoColumnLayout Tests
// ============================================
test('createTwoColumnLayout("body") returns leftColumn and rightColumn', () => {
  const columns = createTwoColumnLayout('body')

  assert.ok(columns.leftColumn)
  assert.ok(columns.rightColumn)
})

test('columns have 50% width and 100% height', () => {
  const columns = createTwoColumnLayout('body')

  assert.equal(columns.leftColumn.width, '50%')
  assert.equal(columns.leftColumn.height, '100%')
  assert.equal(columns.rightColumn.width, '50%')
  assert.equal(columns.rightColumn.height, '100%')
})

test('columns reference correct parent section', () => {
  const columns = createTwoColumnLayout('body')

  assert.equal(columns.leftColumn.section, 'body')
  assert.equal(columns.rightColumn.section, 'body')
})

test('left column has left alignment', () => {
  const columns = createTwoColumnLayout('body')

  assert.equal(columns.leftColumn.align, 'left')
})

test('right column has right alignment', () => {
  const columns = createTwoColumnLayout('body')

  assert.equal(columns.rightColumn.align, 'right')
})

test('createTwoColumnLayout throws without parentSection', () => {
  assert.throws(() => createTwoColumnLayout(), /requires a valid parentSection/)
  assert.throws(
    () => createTwoColumnLayout(''),
    /requires a valid parentSection/
  )
  assert.throws(
    () => createTwoColumnLayout(null),
    /requires a valid parentSection/
  )
  assert.throws(
    () => createTwoColumnLayout(123),
    /requires a valid parentSection/
  )
})

test('createTwoColumnLayout works with different section names', () => {
  const columnsContent = createTwoColumnLayout('content')
  assert.equal(columnsContent.leftColumn.section, 'content')
  assert.equal(columnsContent.rightColumn.section, 'content')

  const columnsScore = createTwoColumnLayout('scoreArea')
  assert.equal(columnsScore.leftColumn.section, 'scoreArea')
  assert.equal(columnsScore.rightColumn.section, 'scoreArea')
})

// ============================================
// Test 6: Token Integration
// ============================================
test('schemas reference TOKENS.spacing values correctly', () => {
  const schema = createStandardPageLayout()

  // Body gap should use TOKENS value converted to percentage
  const expectedGap = `${TOKENS.spacing.headerToContent * 100}%`
  assert.equal(schema.sections.body.gap, expectedGap)
})

test('default heights derive from TOKENS.typography', () => {
  const schema = createStandardPageLayout()

  // Header height should be based on pageTitle * 2
  const expectedHeaderHeight = TOKENS.typography.pageTitle * 2 * 100
  assert.ok(schema.sections.header.height.includes(`${expectedHeaderHeight}`))
})

test('default positions use 0 for top and bottom', () => {
  const schema = createStandardPageLayout()

  // Header starts at top: 0
  assert.equal(schema.sections.header.top, 0)
  // Footer ends at bottom: 0
  assert.equal(schema.sections.footer.bottom, 0)
})

test('standard and score presets default safeTop to 0', () => {
  const standardSchema = createStandardPageLayout()
  const scoreSchema = createScorePageLayout()

  assert.equal(standardSchema.safeTop, 0)
  assert.equal(scoreSchema.safeTop, 0)
})

test('presets preserve provided safeTop value', () => {
  const standardSchema = createStandardPageLayout({ safeTop: 48 })
  const scoreSchema = createScorePageLayout({ safeTop: 36 })

  assert.equal(standardSchema.safeTop, 48)
  assert.equal(scoreSchema.safeTop, 36)
})

test('schema safeTop from presets affects resolveLayout when metrics omit safeTop', () => {
  const scoreSchema = createScorePageLayout({
    safeTop: 30,
    headerTop: 0,
    headerHeight: 100,
    scoreAreaGap: 0,
    footerBottom: 0,
    footerHeight: 50
  })

  const layout = resolveLayout(scoreSchema, mockMetrics)

  assert.equal(layout.sections.header.y, 30)
})

test('square-family metrics safeTop offsets preset sections without extra page changes', () => {
  const layout = resolveLayout(createStandardPageLayout(), {
    width: 390,
    height: 450,
    isRound: false,
    screenFamily: 'w390-s',
    statusBarHeight: 48,
    safeTop: 48
  })

  assert.equal(layout.sections.header.y, 48)
  assert.equal(layout.sections.body.y >= layout.sections.header.y, true)
})

// ============================================
// Test 7: Resolution with layout-engine
// ============================================
test('createStandardPageLayout schema resolves without errors', () => {
  const schema = createStandardPageLayout()

  let layout
  assert.doesNotThrow(() => {
    layout = resolveLayout(schema, mockMetrics)
  })

  assert.ok(layout.sections.header)
  assert.ok(layout.sections.body)
  assert.ok(layout.sections.footer)
})

test('createPageWithFooterButton schema resolves without errors', () => {
  const schema = createPageWithFooterButton()

  let layout
  assert.doesNotThrow(() => {
    layout = resolveLayout(schema, mockMetrics)
  })

  assert.ok(layout.sections.footer)
  assert.ok(layout.elements.footerButton)
})

test('resolved sections have valid numeric coordinates', () => {
  const schema = createStandardPageLayout()
  const layout = resolveLayout(schema, mockMetrics)

  // All sections should have numeric coordinates
  Object.values(layout.sections).forEach((section) => {
    assert.equal(typeof section.x, 'number')
    assert.equal(typeof section.y, 'number')
    assert.equal(typeof section.w, 'number')
    assert.equal(typeof section.h, 'number')
    assert.ok(section.w > 0)
    assert.ok(section.h > 0)
  })
})

test('body section fills remaining space after header and footer', () => {
  const schema = createStandardPageLayout()
  const layout = resolveLayout(schema, mockMetrics)

  const headerBottom = layout.sections.header.y + layout.sections.header.h
  const footerTop = layout.sections.footer.y

  // Body should start at or near header bottom
  assert.ok(layout.sections.body.y >= headerBottom)
  // Body should end at or near footer top
  assert.ok(layout.sections.body.y + layout.sections.body.h <= footerTop)
})

test('footerButton element has valid coordinates', () => {
  const schema = createPageWithFooterButton()
  const layout = resolveLayout(schema, mockMetrics)

  const button = layout.elements.footerButton
  assert.equal(typeof button.x, 'number')
  assert.equal(typeof button.y, 'number')
  assert.equal(typeof button.w, 'number')
  assert.equal(typeof button.h, 'number')
  assert.equal(button.w, TOKENS.sizing.iconLarge)
  assert.equal(button.h, TOKENS.sizing.iconLarge)
})

test('footerButton is centered in footer', () => {
  const schema = createPageWithFooterButton()
  const layout = resolveLayout(schema, mockMetrics)

  const footer = layout.sections.footer
  const button = layout.elements.footerButton

  // Button should be horizontally centered: button.x = (footer.w - button.w) / 2
  const expectedX = (footer.w - button.w) / 2
  assert.equal(button.x, expectedX)
})

test('schema without header resolves correctly', () => {
  const schema = createStandardPageLayout({ hasHeader: false })
  const layout = resolveLayout(schema, mockMetrics)

  assert.equal(layout.sections.header, undefined)
  assert.ok(layout.sections.body)
  assert.ok(layout.sections.footer)

  // Body should start at top (y = 0 or minimal offset from pageBottom)
  assert.ok(layout.sections.body.y < 50)
})

test('schema without footer resolves correctly', () => {
  const schema = createStandardPageLayout({ hasFooter: false })
  const layout = resolveLayout(schema, mockMetrics)

  assert.ok(layout.sections.header)
  assert.ok(layout.sections.body)
  assert.equal(layout.sections.footer, undefined)

  // Body should extend to bottom of screen
  const bodyBottom = layout.sections.body.y + layout.sections.body.h
  assert.ok(bodyBottom >= mockMetrics.height - 50)
})

test('twoColumn elements resolve correctly when merged', () => {
  const baseSchema = createStandardPageLayout()
  const columns = createTwoColumnLayout('body')
  Object.assign(baseSchema.elements, columns)

  const layout = resolveLayout(baseSchema, mockMetrics)

  assert.ok(layout.elements.leftColumn)
  assert.ok(layout.elements.rightColumn)

  // Left column should start at body.x
  assert.equal(layout.elements.leftColumn.x, layout.sections.body.x)
  // Left column width should be 50% of body width
  assert.equal(layout.elements.leftColumn.w, layout.sections.body.w / 2)

  // Right column should be at right edge of body
  const rightEdge = layout.sections.body.x + layout.sections.body.w
  assert.equal(
    layout.elements.rightColumn.x + layout.elements.rightColumn.w,
    rightEdge
  )
})

// ============================================
// Test 8: Round Screen Handling
// ============================================
test('body section has roundSafeInset=true for round screens', () => {
  const schema = createStandardPageLayout()
  const layout = resolveLayout(schema, mockRoundMetrics)

  // Body should have positive x inset on round screen
  assert.ok(layout.sections.body.x > 0)
  assert.ok(layout.sections.body.w < mockRoundMetrics.width)
})

test('footer section has roundSafeInset=false for icon centering', () => {
  const schema = createStandardPageLayout()
  const layout = resolveLayout(schema, mockRoundMetrics)

  // Footer should use full width (no inset)
  assert.equal(layout.sections.footer.x, 0)
  assert.equal(layout.sections.footer.w, mockRoundMetrics.width)
})

test('header section has roundSafeInset=true for round screens', () => {
  const schema = createStandardPageLayout()
  const layout = resolveLayout(schema, mockRoundMetrics)

  // Header should have positive x inset on round screen
  assert.ok(layout.sections.header.x > 0)
  assert.ok(layout.sections.header.w < mockRoundMetrics.width)
})

test('footerButton is centered correctly on round screens', () => {
  const schema = createPageWithFooterButton()
  const layout = resolveLayout(schema, mockRoundMetrics)

  const footer = layout.sections.footer
  const button = layout.elements.footerButton

  // Button should be centered relative to footer width
  const expectedX = (footer.w - button.w) / 2
  assert.equal(button.x, expectedX)
})

// ============================================
// Test 9: Edge Cases
// ============================================
test('empty options object uses all defaults', () => {
  const schema1 = createStandardPageLayout()
  const schema2 = createStandardPageLayout({})

  assert.deepEqual(schema1.sections, schema2.sections)
})

test('custom headerHeight overrides default', () => {
  const schema = createStandardPageLayout({ headerHeight: '20%' })

  assert.equal(schema.sections.header.height, '20%')
})

test('custom footerHeight overrides default', () => {
  const schema = createStandardPageLayout({ footerHeight: '80px' })

  assert.equal(schema.sections.footer.height, '80px')
})

test('custom numeric headerHeight works', () => {
  const schema = createStandardPageLayout({ headerHeight: 100 })

  assert.equal(schema.sections.header.height, 100)
})

test('schema with all custom options resolves', () => {
  const schema = createStandardPageLayout({
    hasHeader: true,
    hasFooter: true,
    headerHeight: '15%',
    footerHeight: '12%'
  })
  const layout = resolveLayout(schema, mockMetrics)

  assert.ok(layout.sections.header)
  assert.ok(layout.sections.body)
  assert.ok(layout.sections.footer)

  // Verify custom heights
  assert.equal(layout.sections.header.h, 75) // 15% of 500
  // Footer height is 12% of 500 = 60, but bottom positioning affects y
  assert.ok(layout.sections.footer.h > 0)
})

test('createPageWithFooterButton with all custom options', () => {
  const onClick = () => {}
  const schema = createPageWithFooterButton({
    icon: 'custom.png',
    onClick,
    hasHeader: false,
    headerHeight: '10%',
    footerHeight: '15%'
  })

  assert.equal(schema.sections.header, undefined)
  assert.ok(schema.sections.footer)
  assert.equal(schema.elements.footerButton._meta.icon, 'custom.png')
  assert.equal(schema.elements.footerButton._meta.onClick, onClick)
})

// ============================================
// Test 10: Integration Tests
// ============================================
test('full integration: standard layout with two columns and footer button', () => {
  // Build a complete page schema
  const schema = createPageWithFooterButton({
    icon: 'back.png',
    hasHeader: true
  })
  const columns = createTwoColumnLayout('body')
  Object.assign(schema.elements, columns)

  const layout = resolveLayout(schema, mockMetrics)

  // Verify all sections exist
  assert.ok(layout.sections.header)
  assert.ok(layout.sections.body)
  assert.ok(layout.sections.footer)

  // Verify all elements exist
  assert.ok(layout.elements.footerButton)
  assert.ok(layout.elements.leftColumn)
  assert.ok(layout.elements.rightColumn)

  // Verify layout integrity
  assert.ok(
    layout.sections.body.y >=
      layout.sections.header.y + layout.sections.header.h
  )
  assert.ok(
    layout.sections.body.y + layout.sections.body.h <= layout.sections.footer.y
  )
})

test('minimal layout: body only', () => {
  const schema = createStandardPageLayout({
    hasHeader: false,
    hasFooter: false
  })
  const layout = resolveLayout(schema, mockMetrics)

  assert.equal(Object.keys(layout.sections).length, 1)
  assert.ok(layout.sections.body)

  // Body should fill entire screen
  assert.equal(layout.sections.body.y, 0)
  assert.equal(layout.sections.body.h, mockMetrics.height)
  assert.equal(layout.sections.body.w, mockMetrics.width)
})

test('layout consistency across multiple calls', () => {
  const schemas = Array(5)
    .fill(null)
    .map(() => createStandardPageLayout())
  const layouts = schemas.map((s) => resolveLayout(s, mockMetrics))

  // All layouts should be identical
  layouts.forEach((layout) => {
    assert.equal(layout.sections.header.h, layouts[0].sections.header.h)
    assert.equal(layout.sections.body.h, layouts[0].sections.body.h)
    assert.equal(layout.sections.footer.h, layouts[0].sections.footer.h)
  })
})
