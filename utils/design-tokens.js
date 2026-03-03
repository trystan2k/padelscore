/**
 * @fileoverview Centralized design tokens for the Padel Buddy app.
 *
 * This module provides standardized design values for colors, typography,
 * spacing, and sizing. All values are centralized to ensure consistency
 * across the application.
 *
 * @module utils/design-tokens
 *
 * NOTE: Future theming capability is planned but not yet implemented.
 * The flat structure of TOKENS prepares for easy theming support.
 */

import { getScreenMetrics } from './screen-utils.js'

/**
 * Centralized design tokens for the Padel Buddy app.
 * Contains colors, typography ratios, spacing ratios, and sizing values.
 *
 * @constant {Object}
 * @property {Object} colors - Color tokens (hex values)
 * @property {Object} typography - Typography scale ratios (multiply by screenWidth)
 * @property {Object} spacing - Spacing scale ratios (multiply by screen dimension)
 * @property {Object} sizing - Sizing values (mix of absolute px and ratios)
 */
export const TOKENS = Object.freeze({
  colors: {
    background: 0x000000,
    text: 0xffffff,
    mutedText: 0x888888,
    accent: 0x1eb98c,
    danger: 0xff6d78,
    primaryButton: 0x1eb98c,
    primaryButtonText: 0x000000,
    secondaryButton: 0x24262b,
    cardBackground: 0x1a1c20,
    disabled: 0x444444,
    divider: 0x333333
  },
  typography: {
    pageTitle: 0.0825,
    sectionTitle: 0.068,
    body: 0.055,
    bodyLarge: 0.08,
    score: 0.15,
    scoreDisplay: 0.28,
    caption: 0.05,
    button: 0.05,
    buttonLarge: 0.075
  },
  spacing: {
    pageTop: 0.05,
    pageBottom: 0.06,
    pageSide: 0.07,
    pageSideRound: 0.12,
    sectionGap: 0.02,
    headerTop: 0.04,
    headerToContent: 0.06,
    footerBottom: 0.07
  },
  sizing: {
    iconSmall: 24,
    iconMedium: 32,
    iconLarge: 48,
    buttonHeight: 35, // 15% of parent section height (for layout engine)
    buttonHeightRatio: 0.22, // Ratio of screen height (for ui-components.js)
    buttonHeightLarge: 0.15,
    buttonWidth: 85, // 85% of parent section width
    buttonRadiusRatio: 0.5,
    cardRadiusRatio: 0.07,
    minTouchTarget: 48
  }
})

/**
 * Retrieves a color value from the TOKENS.colors object using dot notation.
 *
 * @param {string} path - Dot-notation path to the color (e.g., 'colors.accent')
 * @returns {number} The color value as a hex number
 * @throws {Error} If the path is invalid or the color doesn't exist
 *
 * @example
 * getColor('colors.accent')        // Returns 0x1eb98c
 * getColor('colors.primaryButton') // Returns 0x1eb98c
 * getColor('invalid.path')         // Throws Error
 */
export function getColor(path) {
  if (typeof path !== 'string' || !path.includes('.')) {
    throw new Error(
      `Invalid color path: "${path}". Expected format: "colors.tokenName"`
    )
  }

  const [category, key] = path.split('.')

  if (category !== 'colors') {
    throw new Error(`Invalid color path: "${path}". Must start with "colors."`)
  }

  if (!(key in TOKENS.colors)) {
    throw new Error(
      `Unknown color token: "${key}". Available colors: ${Object.keys(TOKENS.colors).join(', ')}`
    )
  }

  return TOKENS.colors[key]
}

/**
 * Calculates the pixel font size for a typography token based on screen width.
 * Uses centralized getScreenMetrics() from screen-utils.js.
 *
 * @param {string} typographyKey - The typography token key (e.g., 'pageTitle', 'body')
 * @returns {number} The calculated font size in pixels, rounded to nearest integer
 * @throws {Error} If the typography key doesn't exist
 *
 * @example
 * getFontSize('pageTitle')  // Returns Math.round(width * 0.0825)
 * getFontSize('body')       // Returns Math.round(width * 0.055)
 */
export function getFontSize(typographyKey) {
  if (!(typographyKey in TOKENS.typography)) {
    throw new Error(
      `Unknown typography token: "${typographyKey}". Available tokens: ${Object.keys(TOKENS.typography).join(', ')}`
    )
  }

  const { width: screenWidth } = getScreenMetrics()
  const ratio = TOKENS.typography[typographyKey]
  return Math.round(screenWidth * ratio)
}

/**
 * Converts a numeric value to a percentage string for layout engine compatibility.
 * Handles both decimal (0.15) and percentage (15) formats.
 *
 * @param {number} value - The value to convert (e.g., 0.15 or 15)
 * @returns {string} Percentage string (e.g., '15%')
 *
 * @example
 * toPercentage(0.15)   // Returns '15%'
 * toPercentage(15)     // Returns '15%'
 * toPercentage(85)     // Returns '85%'
 */
export function toPercentage(value) {
  // If value is a decimal (< 1), multiply by 100
  const percentage = value < 1 ? value * 100 : value
  return `${percentage}%`
}
