/**
 * @fileoverview Declarative layout engine for resolving UI schemas to pixel coordinates.
 *
 * Provides a two-pass resolution system:
 * 1. Section pass: Resolves vertical sections with percentage/fill height support
 * 2. Element pass: Positions elements within sections using references and alignment
 *
 * @module utils/layout-engine
 */

import {
  clamp,
  ensureNumber,
  getRoundSafeSectionInset,
  getScreenMetrics,
  pct
} from './screen-utils.js'

/**
 * Resolves a layout schema to pixel coordinates.
 *
 * @param {Object} schema - The layout schema
 * @param {Object} schema.sections - Map of section definitions
 * @param {Object} schema.elements - Map of element definitions
 * @param {Object} [metrics] - Screen metrics (optional, uses getScreenMetrics() if not provided)
 * @returns {{sections: Object, elements: Object}} Resolved coordinates
 *
 * @example
 * const layout = resolveLayout({
 *   sections: {
 *     header: { height: '15%', top: 0 },
 *     content: { height: 'fill', after: 'header' },
 *     footer: { height: '60px', bottom: 0 }
 *   },
 *   elements: {
 *     title: { section: 'header', x: 'center', y: '10%', width: '80%', height: '50%' }
 *   }
 * })
 */
export function resolveLayout(schema, metrics) {
  try {
    const safeSchema = ensureSchema(schema)
    const resolvedMetrics = metrics || getScreenMetrics()
    const { width, height, isRound } = resolvedMetrics

    // Validate and sanitize metrics
    const safeWidth = ensureNumber(width, 390)
    const safeHeight = ensureNumber(height, 450)
    const safeIsRound = Boolean(isRound)
    const safeTop = clamp(
      ensureNumber(
        resolvedMetrics?.safeTop,
        ensureNumber(safeSchema.safeTop, 0)
      ),
      0,
      safeHeight
    )

    // Initialize result containers
    const resolvedSections = {}
    const resolvedElements = {}

    // Pass 1: Resolve sections (with error handling)
    try {
      resolveSections(
        safeSchema.sections,
        resolvedSections,
        safeWidth,
        safeHeight,
        safeIsRound,
        safeTop
      )
    } catch (sectionError) {
      // Log in development, continue with empty sections
      console.error('Section resolution error:', sectionError)
    }

    // Pass 2: Resolve elements (with error handling)
    try {
      resolveElements(
        safeSchema.elements,
        resolvedElements,
        resolvedSections,
        safeWidth,
        safeHeight
      )
    } catch (elementError) {
      // Log in development, continue with empty elements
      console.error('Element resolution error:', elementError)
    }

    return {
      sections: resolvedSections,
      elements: resolvedElements
    }
  } catch {
    // Ultimate fallback - return empty layout
    return { sections: {}, elements: {} }
  }
}

/**
 * Safe wrapper for resolveLayout that never throws.
 *
 * @param {Object} schema - The layout schema
 * @param {Object} [metrics] - Screen metrics
 * @returns {{sections: Object, elements: Object}} Resolved coordinates (empty on error)
 */
export function safeResolveLayout(schema, metrics) {
  try {
    return resolveLayout(schema, metrics)
  } catch {
    return { sections: {}, elements: {} }
  }
}

/**
 * Validates and normalizes a schema object.
 *
 * @param {*} schema - The schema to validate
 * @returns {Object} Normalized schema with sections and elements
 */
function ensureSchema(schema) {
  if (!schema || typeof schema !== 'object') {
    return { safeTop: 0, sections: {}, elements: {} }
  }
  return {
    safeTop: schema.safeTop,
    sections: schema.sections || {},
    elements: schema.elements || {}
  }
}

/**
 * Parses a value that may be a percentage, reference, expression, or pixel value.
 *
 * @param {*} value - The value to parse
 * @param {Object} context - Resolution context with dimensions and resolved sections
 * @param {number} context.baseDimension - Base dimension for percentage calculation
 * @param {Object} [context.sections] - Resolved sections for reference lookup
 * @param {string} [context.refType] - 'y' for vertical references, 'x' for horizontal
 * @returns {number|null} The resolved pixel value, or null for special keywords (fill, center)
 */
function parseValue(value, context) {
  // Null/undefined → 0
  if (value == null) return 0

  // Number → treat as pixels
  if (typeof value === 'number') {
    return ensureNumber(value, 0)
  }

  // String parsing
  if (typeof value === 'string') {
    // Percentage: "10%", "2.5%"
    const percentMatch = value.match(/^(\d+(?:\.\d+)?)%$/)
    if (percentMatch) {
      const percentage = parseFloat(percentMatch[1])
      const clampedPct = clamp(percentage, 0, 100)
      return Math.round(pct(context.baseDimension, clampedPct))
    }

    // Expression with reference and offset: "header.bottom + 2%", "content.top - 10px"
    const exprMatch = value.match(
      /^(\w+)\.(\w+)\s*([+-])\s*(\d+(?:\.\d+)?)(%|px)?$/
    )
    if (exprMatch && context.sections) {
      const [, sectionName, property, operator, offset, unit] = exprMatch
      const baseValue = getSectionProperty(
        context.sections,
        sectionName,
        property,
        context.refType
      )
      const offsetValue =
        unit === '%'
          ? Math.round(
              pct(context.baseDimension, clamp(parseFloat(offset), 0, 100))
            )
          : ensureNumber(parseFloat(offset), 0)

      return operator === '+'
        ? baseValue + offsetValue
        : baseValue - offsetValue
    }

    // Simple reference: "header.bottom", "content.top"
    const refMatch = value.match(/^(\w+)\.(\w+)$/)
    if (refMatch && context.sections) {
      const [, sectionName, property] = refMatch
      return getSectionProperty(
        context.sections,
        sectionName,
        property,
        context.refType
      )
    }

    // 'fill' keyword - handled specially in section resolution
    if (value === 'fill') {
      return null // Signal for fill calculation
    }

    // 'center' keyword - handled in element alignment
    if (value === 'center') {
      return null // Signal for centering
    }

    // Pixel string: "50px"
    const pxMatch = value.match(/^(\d+(?:\.\d+)?)px$/)
    if (pxMatch) {
      return ensureNumber(parseFloat(pxMatch[1]), 0)
    }
  }

  // Fallback
  return 0
}

function isSectionReferenceExpression(value) {
  return (
    typeof value === 'string' &&
    /^(\w+)\.(\w+)(\s*[+-]\s*\d+(?:\.\d+)?(%|px)?)?$/.test(value)
  )
}

/**
 * Gets a property value from a resolved section.
 *
 * @param {Object} sections - Resolved sections lookup
 * @param {string} sectionName - Name of the section
 * @param {string} property - Property name (top, bottom, left, right)
 * @param {string} refType - 'y' or 'x' for dimension context
 * @returns {number} The property value or 0 if not found
 */
function getSectionProperty(sections, sectionName, property, _refType) {
  const section = sections[sectionName]
  if (!section) return 0

  switch (property) {
    case 'top':
      return section.y
    case 'bottom':
      return section.y + section.h
    case 'left':
      return section.x
    case 'right':
      return section.x + section.w
    default:
      return 0
  }
}

/**
 * Normalizes a section definition with defaults.
 *
 * @param {*} section - The section to normalize
 * @returns {Object} Normalized section with default values
 */
function normalizeSection(section) {
  if (!section || typeof section !== 'object') {
    return { roundSafeInset: true, sideInset: 0 }
  }
  return {
    top: section.top,
    bottom: section.bottom,
    after: section.after,
    gap: section.gap,
    height: section.height,
    sideInset: section.sideInset ?? 0,
    roundSafeInset: section.roundSafeInset ?? true
  }
}

/**
 * Parses gap value to pixels.
 *
 * @param {*} gap - The gap value to parse
 * @param {number} verticalBase - Vertical base dimension for percentage calculation
 * @returns {number} The gap in pixels
 */
function parseGap(gap, verticalBase) {
  if (gap == null) return 0
  if (typeof gap === 'number') return gap
  if (typeof gap === 'string' && gap.endsWith('%')) {
    return parseValue(gap, { baseDimension: verticalBase })
  }
  return 0
}

/**
 * Calculates side inset for a section.
 *
 * @param {Object} section - Normalized section definition
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @param {number} top - Section top position
 * @param {number} sectionHeight - Section height
 * @param {boolean} isRound - Whether screen is round
 * @returns {number} The side inset value
 */
function calculateSideInset(
  section,
  width,
  height,
  top,
  sectionHeight,
  isRound
) {
  // Explicit side inset takes precedence
  if (section.sideInset != null && section.sideInset !== 0) {
    if (
      typeof section.sideInset === 'string' &&
      section.sideInset.endsWith('%')
    ) {
      return parseValue(section.sideInset, { baseDimension: width })
    }
    return ensureNumber(section.sideInset, 0)
  }

  // Round screen safe inset
  if (isRound && section.roundSafeInset !== false) {
    return getRoundSafeSectionInset(width, height, top, sectionHeight)
  }

  return 0
}

/**
 * Resolves all sections to pixel coordinates.
 *
 * Uses a multi-pass approach:
 * 1. First pass: Categorize sections and resolve simple ones (top/after with resolved deps)
 * 2. Second pass: Resolve sections with expression-based top positions
 * 3. Third pass: Resolve bottom-anchored sections
 * 4. Fourth pass: Distribute remaining space to fill sections
 * 5. Fifth pass: Resolve sections that depend on fill sections
 *
 * @param {Object} sections - Section definitions
 * @param {Object} resolved - Output object for resolved sections
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @param {boolean} isRound - Whether screen is round
 * @param {number} safeTop - Reserved top inset for system UI
 */
function resolveSections(sections, resolved, width, height, isRound, safeTop) {
  const sectionNames = Object.keys(sections)
  const verticalBase = Math.max(0, height - safeTop)

  // Track sections that need deferred resolution
  const fillSections = []
  const bottomAnchoredSections = []
  const expressionSections = []
  const dependentSections = [] // Sections that depend on fill sections

  // Helper to check if a section's dependencies are resolved
  const canResolve = (safeSection) => {
    if (safeSection.after) {
      const dep = resolved[safeSection.after]
      // Dependency must exist and have non-zero height (or not be a fill placeholder)
      return dep && dep.h > 0
    }
    return true
  }

  // First pass: categorize and resolve simple sections
  sectionNames.forEach((name) => {
    const section = sections[name]
    const safeSection = normalizeSection(section)

    // Categorize bottom-anchored sections (no top, no after, has bottom)
    if (
      safeSection.bottom != null &&
      safeSection.top == null &&
      !safeSection.after
    ) {
      bottomAnchoredSections.push({ name, section: safeSection })
      return
    }

    // Check if top is an expression referencing other sections
    if (isSectionReferenceExpression(safeSection.top)) {
      expressionSections.push({ name, section: safeSection })
      return
    }

    // Handle fill sections - track for later
    if (safeSection.height === 'fill') {
      fillSections.push({ name, section: safeSection })
      resolved[name] = { x: 0, y: 0, w: width, h: 0 } // Placeholder
      return
    }

    // Check if dependencies are resolved
    if (!canResolve(safeSection)) {
      dependentSections.push({ name, section: safeSection })
      return
    }

    // Resolve simple sections immediately
    resolveSection(
      name,
      safeSection,
      resolved,
      width,
      height,
      isRound,
      safeTop,
      verticalBase
    )
  })

  // Second pass: resolve sections with expression-based top positions
  expressionSections.forEach(({ name, section: safeSection }) => {
    resolveSection(
      name,
      safeSection,
      resolved,
      width,
      height,
      isRound,
      safeTop,
      verticalBase
    )
  })

  // Third pass: resolve bottom-anchored sections
  // First resolve simple ones (bottom: 0, bottom: '10%', etc.)
  const simpleBottom = bottomAnchoredSections.filter(
    ({ section }) =>
      typeof section.bottom === 'number' ||
      (typeof section.bottom === 'string' &&
        section.bottom.match(/^\d+(?:\.\d+)?%?$/))
  )
  const exprBottom = bottomAnchoredSections.filter(
    ({ section }) =>
      typeof section.bottom === 'string' && section.bottom.includes('.')
  )

  simpleBottom.forEach(({ name, section: safeSection }) => {
    resolveBottomAnchoredSection(
      name,
      safeSection,
      resolved,
      width,
      height,
      isRound,
      safeTop,
      verticalBase
    )
  })

  exprBottom.forEach(({ name, section: safeSection }) => {
    resolveBottomAnchoredSection(
      name,
      safeSection,
      resolved,
      width,
      height,
      isRound,
      safeTop,
      verticalBase
    )
  })

  // Fourth pass: distribute remaining space to fill sections
  if (fillSections.length > 0) {
    resolveFillSections(
      fillSections,
      sections,
      resolved,
      width,
      height,
      isRound,
      safeTop,
      verticalBase
    )
  }

  // Fifth pass: resolve sections that depend on fill sections
  dependentSections.forEach(({ name, section: safeSection }) => {
    resolveSection(
      name,
      safeSection,
      resolved,
      width,
      height,
      isRound,
      safeTop,
      verticalBase
    )
  })
}

/**
 * Resolves a single section with top/after positioning.
 */
function resolveSection(
  name,
  safeSection,
  resolved,
  width,
  height,
  isRound,
  safeTop,
  verticalBase
) {
  let top = safeTop

  if (safeSection.top != null) {
    const parsedTop = parseValue(safeSection.top, {
      baseDimension: verticalBase,
      sections: resolved,
      refType: 'y'
    })

    if (isSectionReferenceExpression(safeSection.top)) {
      top = parsedTop
    } else {
      top = safeTop + parsedTop
    }
  } else if (safeSection.after) {
    const afterSection = resolved[safeSection.after]
    if (afterSection) {
      top =
        afterSection.y +
        afterSection.h +
        parseGap(safeSection.gap, verticalBase)
    }
  }

  top = Math.max(safeTop, top)

  const sectionHeight = calculateSectionHeight(safeSection, verticalBase)
  const sideInset = calculateSideInset(
    safeSection,
    width,
    height,
    top,
    sectionHeight,
    isRound
  )

  resolved[name] = {
    x: sideInset,
    y: top,
    w: width - sideInset * 2,
    h: sectionHeight
  }
}

/**
 * Resolves a bottom-anchored section.
 *
 * Bottom value interpretation:
 * - bottom: 0 → section's bottom edge is at screen bottom (height)
 * - bottom: '10%' → section's bottom edge is at 90% of screen height (height - 10%)
 * - bottom: '50px' → section's bottom edge is 50px from screen bottom (height - 50)
 * - bottom: 'footer.top - 5%' → expression relative to another section
 */
function resolveBottomAnchoredSection(
  name,
  safeSection,
  resolved,
  width,
  height,
  isRound,
  safeTop,
  verticalBase
) {
  // Parse bottom value - it represents distance from screen bottom
  // bottom: 0 means bottom edge at height, so actual bottom Y = height - 0 = height
  // bottom: 10 means bottom edge at height - 10
  let bottomY = height

  if (safeSection.bottom != null) {
    if (typeof safeSection.bottom === 'number') {
      // bottom: 0 means at screen bottom, so bottomY = height - 0 = height
      bottomY = height - safeSection.bottom
    } else if (typeof safeSection.bottom === 'string') {
      // Check if it's an expression like 'footer.top - 5%'
      const exprMatch = safeSection.bottom.match(
        /^(\w+)\.(\w+)\s*([+-])\s*(\d+(?:\.\d+)?)(%|px)?$/
      )
      if (exprMatch) {
        const baseValue = getSectionProperty(
          resolved,
          exprMatch[1],
          exprMatch[2],
          'y'
        )
        const offset =
          exprMatch[5] === '%'
            ? Math.round(
                pct(verticalBase, clamp(parseFloat(exprMatch[4]), 0, 100))
              )
            : ensureNumber(parseFloat(exprMatch[4]), 0)
        bottomY = exprMatch[3] === '+' ? baseValue + offset : baseValue - offset
      } else if (safeSection.bottom.endsWith('%')) {
        // bottom: '10%' means 10% from bottom, so bottomY = height - 10%
        const pctValue = parseValue(safeSection.bottom, {
          baseDimension: verticalBase
        })
        bottomY = height - pctValue
      } else {
        // Treat as pixel value
        const pxValue = parseValue(safeSection.bottom, {
          baseDimension: verticalBase
        })
        bottomY = height - pxValue
      }
    }
  }

  const sectionHeight = calculateSectionHeight(safeSection, verticalBase)
  const top = Math.max(safeTop, bottomY - sectionHeight)
  const sideInset = calculateSideInset(
    safeSection,
    width,
    height,
    top,
    sectionHeight,
    isRound
  )

  resolved[name] = {
    x: sideInset,
    y: top,
    w: width - sideInset * 2,
    h: sectionHeight
  }
}

/**
 * Resolves fill sections by distributing remaining space.
 */
function resolveFillSections(
  fillSections,
  allSections,
  resolved,
  width,
  height,
  isRound,
  safeTop,
  verticalBase
) {
  // Calculate total fixed height (non-fill sections)
  let totalFixedHeight = 0
  const allNames = Object.keys(allSections)

  allNames.forEach((name) => {
    const section = allSections[name]
    const safeSection = normalizeSection(section)

    if (safeSection.height !== 'fill') {
      totalFixedHeight += calculateSectionHeight(safeSection, verticalBase)
      // Add gap if this section has an 'after' reference
      if (safeSection.after) {
        totalFixedHeight += parseGap(safeSection.gap, verticalBase)
      }
    }
  })

  // Also add gaps from fill sections themselves (they reduce available space)
  fillSections.forEach(({ section: safeSection }) => {
    if (safeSection.after) {
      totalFixedHeight += parseGap(safeSection.gap, verticalBase)
    }
  })

  const remainingHeight = Math.max(0, verticalBase - totalFixedHeight)
  const fillHeightEach = Math.floor(remainingHeight / fillSections.length)

  fillSections.forEach(({ name, section: safeSection }, index) => {
    // Calculate top position
    let top = safeTop
    if (safeSection.top != null) {
      const parsedTop = parseValue(safeSection.top, {
        baseDimension: verticalBase,
        sections: resolved,
        refType: 'y'
      })

      if (isSectionReferenceExpression(safeSection.top)) {
        top = parsedTop
      } else {
        top = safeTop + parsedTop
      }
    } else if (safeSection.after) {
      const afterSection = resolved[safeSection.after]
      if (afterSection) {
        top =
          afterSection.y +
          afterSection.h +
          parseGap(safeSection.gap, verticalBase)
      }
    }

    top = Math.max(safeTop, top)

    const isLast = index === fillSections.length - 1
    const sectionHeight = isLast
      ? remainingHeight - fillHeightEach * index
      : fillHeightEach

    const sideInset = calculateSideInset(
      safeSection,
      width,
      height,
      top,
      sectionHeight,
      isRound
    )

    resolved[name] = {
      x: sideInset,
      y: top,
      w: width - sideInset * 2,
      h: Math.max(0, sectionHeight)
    }
  })
}

/**
 * Calculates section height from definition.
 *
 * @param {Object} section - Normalized section definition
 * @param {number} verticalBase - Vertical base dimension for percentage calculation
 * @returns {number} Section height in pixels
 */
function calculateSectionHeight(section, verticalBase) {
  if (section.height == null || section.height === 'fill') return 0

  if (typeof section.height === 'number') {
    return section.height
  }

  return parseValue(section.height, { baseDimension: verticalBase }) || 0
}

/**
 * Normalizes an element definition with defaults.
 *
 * @param {*} element - The element to normalize
 * @returns {Object} Normalized element with default values
 */
function normalizeElement(element) {
  if (!element || typeof element !== 'object') {
    return { x: 0, y: 0, width: 0, height: 0, align: 'left' }
  }
  return {
    section: element.section,
    x: element.x ?? 0,
    y: element.y ?? 0,
    width: element.width ?? 0,
    height: element.height ?? 0,
    align: element.align ?? 'left'
  }
}

/**
 * Applies horizontal alignment to element position.
 *
 * @param {string} align - Alignment mode ('left', 'center', 'right')
 * @param {number} x - Current x position
 * @param {number} elemWidth - Element width
 * @param {Object} section - Parent section bounds
 * @returns {number} Adjusted x position
 */
function applyAlignment(align, x, elemWidth, section) {
  switch (align) {
    case 'center':
      return (section.w - elemWidth) / 2
    case 'right':
      return section.w - elemWidth
    default:
      return x
  }
}

/**
 * Resolves all elements to pixel coordinates.
 *
 * @param {Object} elements - Element definitions
 * @param {Object} resolved - Output object for resolved elements
 * @param {Object} sections - Resolved sections for reference
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 */
function resolveElements(elements, resolved, sections, width, height) {
  Object.keys(elements).forEach((name) => {
    const element = elements[name]
    const safeElement = normalizeElement(element)

    // Get parent section or use full screen
    const parentSection =
      safeElement.section && sections[safeElement.section]
        ? sections[safeElement.section]
        : { x: 0, y: 0, w: width, h: height }

    // Parse dimensions
    const elemWidth = parseValue(safeElement.width, {
      baseDimension: parentSection.w,
      sections
    })

    const elemHeight = parseValue(safeElement.height, {
      baseDimension: parentSection.h,
      sections
    })

    // Parse position (relative to section origin)
    let x = parseValue(safeElement.x, {
      baseDimension: parentSection.w,
      sections,
      refType: 'x'
    })

    const y = parseValue(safeElement.y, {
      baseDimension: parentSection.h,
      sections,
      refType: 'y'
    })

    // Apply alignment
    x = applyAlignment(safeElement.align, x, elemWidth, parentSection)

    // Handle 'center' keyword for x position
    if (safeElement.x === 'center') {
      x = applyAlignment('center', 0, elemWidth || 0, parentSection)
    }

    // Final coordinates (relative to screen origin)
    resolved[name] = {
      x: clamp(parentSection.x + x, 0, width - (elemWidth || 0)),
      y: clamp(parentSection.y + y, 0, height - (elemHeight || 0)),
      w: clamp(elemWidth, 0, width),
      h: clamp(elemHeight, 0, height)
    }
  })
}
