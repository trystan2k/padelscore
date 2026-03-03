/**
 * @fileoverview Reusable UI component factories using design tokens.
 *
 * Provides factory functions that return widget configuration objects
 * for consistent UI elements across the Padel Buddy app.
 *
 * @module utils/ui-components
 */

import { getFontSize, TOKENS } from './design-tokens.js'
import { getScreenMetrics } from './screen-utils.js'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates that a required parameter is provided.
 * @param {*} value - The value to check
 * @param {string} paramName - Parameter name for error message
 * @throws {Error} If value is null or undefined
 */
function requireParam(value, paramName) {
  if (value === null || value === undefined) {
    throw new Error(`Missing required parameter: ${paramName}`)
  }
}

// ============================================================================
// SHAPE FACTORIES
// ============================================================================

/**
 * Creates a full-screen background widget configuration.
 *
 * @param {Object} [options] - Optional overrides
 * @param {number} [options.color] - Background color (default: TOKENS.colors.background)
 * @returns {Object} Widget configuration for hmUI.widget.FILL_RECT
 *
 * @example
 * const bgConfig = createBackground()
 * hmUI.createWidget(bgConfig.widgetType, bgConfig.config)
 */
export function createBackground(options = {}) {
  const { width, height } = getScreenMetrics()

  return {
    widgetType: hmUI.widget.FILL_RECT,
    config: {
      x: 0,
      y: 0,
      w: width,
      h: height,
      color: options.color ?? TOKENS.colors.background
    }
  }
}

/**
 * Creates a horizontal or vertical divider widget configuration.
 *
 * @param {Object} config - Divider configuration
 * @param {number} config.x - X position (required)
 * @param {number} config.y - Y position (required)
 * @param {number} [config.w] - Width (for horizontal divider)
 * @param {number} [config.h] - Height (for vertical divider, default: 1)
 * @param {number} [config.thickness] - Divider thickness (default: 1)
 * @param {number} [config.color] - Divider color (default: TOKENS.colors.divider)
 * @param {'horizontal'|'vertical'} [config.orientation] - Divider orientation (default: 'horizontal')
 * @returns {Object} Widget configuration for hmUI.widget.FILL_RECT
 * @throws {Error} If x or y is missing
 *
 * @example
 * // Horizontal divider
 * const hDivider = createDivider({ x: 20, y: 100, w: 350 })
 * hmUI.createWidget(hDivider.widgetType, hDivider.config)
 *
 * // Vertical divider
 * const vDivider = createDivider({ x: 195, y: 50, h: 100, orientation: 'vertical' })
 * hmUI.createWidget(vDivider.widgetType, vDivider.config)
 */
export function createDivider(config) {
  requireParam(config?.x, 'x')
  requireParam(config?.y, 'y')

  const orientation = config.orientation ?? 'horizontal'
  const thickness = config.thickness ?? 1
  const { width } = getScreenMetrics()

  const dividerConfig = {
    x: config.x,
    y: config.y,
    color: config.color ?? TOKENS.colors.divider
  }

  if (orientation === 'horizontal') {
    dividerConfig.w = config.w ?? width
    dividerConfig.h = thickness
  } else {
    dividerConfig.w = thickness
    dividerConfig.h = config.h ?? thickness
  }

  return {
    widgetType: hmUI.widget.FILL_RECT,
    config: dividerConfig
  }
}

// ============================================================================
// TEXT FACTORIES
// ============================================================================

/**
 * Creates a text widget configuration with style-based sizing.
 *
 * @param {Object} config - Text configuration
 * @param {string} config.text - Text content (required)
 * @param {string} config.style - Typography style from TOKENS.typography (required)
 * @param {number} [config.x] - X position (default: 0)
 * @param {number} [config.y] - Y position (default: 0)
 * @param {number} [config.w] - Width (default: screen width)
 * @param {number} [config.h] - Height (default: calculated from style)
 * @param {number} [config.color] - Text color (default: TOKENS.colors.text)
 * @param {string} [config.align_h] - Horizontal alignment (default: hmUI.align.CENTER_H)
 * @param {string} [config.align_v] - Vertical alignment (default: hmUI.align.CENTER_V)
 * @returns {Object} Widget configuration for hmUI.widget.TEXT
 * @throws {Error} If text or style is missing
 *
 * @example
 * const textConfig = createText({
 *   text: 'Hello World',
 *   style: 'body',
 *   y: 100
 * })
 * hmUI.createWidget(textConfig.widgetType, textConfig.config)
 */
export function createText(config) {
  requireParam(config?.text, 'text')
  requireParam(config?.style, 'style')

  const { width } = getScreenMetrics()
  const textHeight = Math.round(getFontSize(config.style) * 1.4) // Line height factor

  return {
    widgetType: hmUI.widget.TEXT,
    config: {
      x: config.x ?? 0,
      y: config.y ?? 0,
      w: config.w ?? width,
      h: config.h ?? textHeight,
      text: config.text,
      text_size: getFontSize(config.style),
      color: config.color ?? TOKENS.colors.text,
      align_h: config.align_h ?? hmUI.align.CENTER_H,
      align_v: config.align_v ?? hmUI.align.CENTER_V
    }
  }
}

// ============================================================================
// BUTTON FACTORIES
// ============================================================================

/**
 * Button variant configurations mapping to design tokens.
 */
const BUTTON_VARIANTS = {
  primary: {
    normalColor: 'primaryButton',
    pressColor: 'primaryButton',
    textColor: 'primaryButtonText'
  },
  secondary: {
    normalColor: 'secondaryButton',
    pressColor: 'secondaryButton',
    textColor: 'text'
  },
  danger: {
    normalColor: 'danger',
    pressColor: 'danger',
    textColor: 'text'
  },
  icon: {
    // Icon buttons use normal_src/press_src instead of colors
    normalColor: null,
    pressColor: null,
    textColor: null
  }
}

/**
 * Creates a button widget configuration with variant support.
 *
 * @param {Object} config - Button configuration
 * @param {string} config.text - Button text content (required for non-icon buttons)
 * @param {Function} config.onClick - Click handler (required)
 * @param {string} [config.variant] - Button variant: 'primary', 'secondary', 'danger', 'icon' (default: 'primary')
 * @param {number} [config.x] - X position (default: centered)
 * @param {number} [config.y] - Y position (required)
 * @param {number} [config.w] - Width (default: 85% of screen width)
 * @param {number} [config.h] - Height (default: screen height * TOKENS.sizing.buttonHeightRatio)
 * @param {number} [config.radius] - Corner radius (default: h * TOKENS.sizing.buttonRadiusRatio)
 * @param {boolean} [config.disabled] - Whether button is disabled
 * @param {string} [config.normal_src] - Normal state image for icon variant
 * @param {string} [config.press_src] - Pressed state image for icon variant
 * @returns {Object} Widget configuration for hmUI.widget.BUTTON
 * @throws {Error} If onClick is missing, or if text is missing for non-icon variants
 *
 * @example
 * // Primary button
 * const btnConfig = createButton({
 *   text: 'Start Match',
 *   onClick: () => router.push({ url: 'page/match' }),
 *   y: 300
 * })
 * hmUI.createWidget(btnConfig.widgetType, btnConfig.config)
 *
 * // Secondary button
 * const secBtn = createButton({
 *   text: 'Cancel',
 *   variant: 'secondary',
 *   onClick: () => {},
 *   y: 380
 * })
 *
 * // Danger button
 * const dangerBtn = createButton({
 *   text: 'Reset',
 *   variant: 'danger',
 *   onClick: () => {},
 *   y: 380
 * })
 *
 * // Icon button
 * const iconBtn = createButton({
 *   variant: 'icon',
 *   normal_src: 'icon.png',
 *   press_src: 'icon_pressed.png',
 *   onClick: () => {},
 *   x: 10,
 *   y: 10
 * })
 */
export function createButton(config) {
  requireParam(config?.onClick, 'onClick')

  const variant = config.variant ?? 'primary'
  const { width, height } = getScreenMetrics()
  const variantConfig = BUTTON_VARIANTS[variant]

  // Validate text requirement for non-icon variants
  if (variant !== 'icon') {
    requireParam(config?.text, 'text')
  } else {
    requireParam(config?.normal_src, 'normal_src')
  }

  // Calculate default dimensions
  const buttonHeight =
    config.h ?? Math.round(height * TOKENS.sizing.buttonHeightRatio)
  const buttonWidth = config.w ?? Math.round(width * 0.85)
  const radius =
    config.radius ?? Math.round(buttonHeight * TOKENS.sizing.buttonRadiusRatio)

  // Build button configuration
  const buttonConfig = {
    x: config.x ?? Math.round((width - buttonWidth) / 2),
    y: config.y,
    w: buttonWidth,
    h: buttonHeight,
    radius,
    click_func: config.onClick
  }

  // Handle disabled state
  if (config.disabled) {
    buttonConfig.normal_color = TOKENS.colors.disabled
    buttonConfig.press_color = TOKENS.colors.disabled
    buttonConfig.color = TOKENS.colors.mutedText
    if (config.text) {
      buttonConfig.text = config.text
      buttonConfig.text_size = getFontSize('buttonLarge')
    }
    return {
      widgetType: hmUI.widget.BUTTON,
      config: buttonConfig
    }
  }

  // Apply variant-specific configuration
  if (variant === 'icon') {
    buttonConfig.normal_src = config.normal_src
    buttonConfig.press_src = config.press_src ?? config.normal_src
    buttonConfig.w = config.w ?? -1 // -1 for auto-sizing icon buttons
    buttonConfig.h = config.h ?? -1
    delete buttonConfig.radius // Icon buttons typically don't have radius
  } else {
    buttonConfig.normal_color = TOKENS.colors[variantConfig.normalColor]
    buttonConfig.press_color = TOKENS.colors[variantConfig.pressColor]
    buttonConfig.color = TOKENS.colors[variantConfig.textColor]
    buttonConfig.text = config.text
    buttonConfig.text_size = getFontSize('buttonLarge')
  }

  return {
    widgetType: hmUI.widget.BUTTON,
    config: buttonConfig
  }
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Re-export for convenience
export { getColor, getFontSize, TOKENS } from './design-tokens.js'
