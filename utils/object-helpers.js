/**
 * @typedef {Object} MatchStateKeys
 * @property {string[]} state - Keys for match state comparison
 * @property {string[]} session - Keys for session comparison
 */

/** @type {MatchStateKeys} - Internal use only */
const COMPARISON_KEYS = {
  state: [
    'status',
    'setsToPlay',
    'setsNeededToWin',
    'setsWon',
    'currentSet',
    'currentGame',
    'teamA',
    'teamB',
    'currentSetStatus',
    'setHistory',
    'updatedAt'
  ],
  session: [
    'status',
    'setsToPlay',
    'setsNeededToWin',
    'setsWon',
    'currentSet',
    'currentGame',
    'setHistory',
    'schemaVersion',
    'updatedAt',
    'timing',
    'teams',
    'winnerTeam',
    'winner'
  ]
}

const objectHasOwnProperty = Object.prototype.hasOwnProperty

function hasOwn(target, key) {
  return objectHasOwnProperty.call(target, key)
}

/**
 * Creates a shallow clone of an object.
 * @template T
 * @param {T} obj
 * @returns {T}
 * @description Performance: O(n) where n is number of own properties
 * Does NOT clone nested objects - use deepCopyState() for that.
 * @reserved Currently unused - reserved for future use
 */
export function shallowClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return /** @type {any} */ (obj.slice())
  }

  return { ...obj }
}

/**
 * Performs shallow equality comparison between two objects.
 * @template {Record<string, any>} T
 * @param {T} left
 * @param {T} right
 * @returns {boolean}
 * @description Performance: O(n) where n is number of keys in objects
 * Only compares top-level properties. For nested objects, compares references.
 */
export function shallowEqual(left, right) {
  // Handle identical references
  if (left === right) {
    return true
  }

  // Handle null/undefined cases
  if (left === null || right === null) {
    return left === right
  }

  if (left === undefined || right === undefined) {
    return left === right
  }

  // Quick length check for objects
  if (typeof left !== 'object' || typeof right !== 'object') {
    return left === right
  }

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  // Compare each key
  for (let i = 0; i < leftKeys.length; i += 1) {
    const key = leftKeys[i]

    if (!hasOwn(right, key)) {
      return false
    }

    if (left[key] !== right[key]) {
      return false
    }
  }

  return true
}

/**
 * Compares two values for deep equality (recursive for objects).
 * @param {any} left
 * @param {any} right
 * @returns {boolean}
 */
function valuesEqual(left, right) {
  if (left === right) {
    return true
  }

  if (left === null || right === null) {
    return left === right
  }

  if (left === undefined || right === undefined) {
    return left === right
  }

  if (typeof left !== 'object' || typeof right !== 'object') {
    return left === right
  }

  // For arrays and objects, compare keys and recursive values
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  for (let i = 0; i < leftKeys.length; i += 1) {
    const key = leftKeys[i]

    if (!hasOwn(right, key)) {
      return false
    }

    if (!valuesEqual(left[key], right[key])) {
      return false
    }
  }

  return true
}

/**
 * Compares two objects for equality using specific keys.
 * @template {Record<string, any>} T
 * @param {T} left
 * @param {T} right
 * @param {string[]} keys - Array of keys to compare
 * @returns {boolean}
 * @description Performance: O(k) where k is number of keys to compare
 * More efficient than shallowEqual when only specific keys matter.
 * Uses deep comparison for nested objects to ensure correct score comparisons.
 */
export function stateKeysEqual(left, right, keys) {
  if (left === right) {
    return true
  }

  if (left === null || right === null) {
    return left === right
  }

  if (left === undefined || right === undefined) {
    return left === right
  }

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]

    // Use deep comparison for nested objects
    if (!valuesEqual(left[key], right[key])) {
      return false
    }
  }

  return true
}

/**
 * Compares score-related keys for match state equality.
 * @param {Record<string, any>} leftState
 * @param {Record<string, any>} rightState
 * @returns {boolean}
 * @description Optimized for scoring hot-path - compares only score-relevant keys,
 * but also checks that no unexpected keys that exist in BOTH states have changed.
 */
export function scoresEqual(leftState, rightState) {
  // First check if states are identical reference
  if (leftState === rightState) {
    return true
  }

  // Get all keys from both states
  const leftKeys = Object.keys(leftState || {})
  const rightKeys = Object.keys(rightState || {})

  // Find keys that exist in BOTH states but are NOT in our comparison list
  const rightKeySet = new Set(rightKeys)

  for (const key of leftKeys) {
    // Skip keys in our comparison list - they're handled by stateKeysEqual
    if (COMPARISON_KEYS.state.includes(key)) {
      continue
    }

    // Only compare if key exists in BOTH states (ignore extra keys in one state only)
    if (rightKeySet.has(key)) {
      // Use deep comparison for extra keys (they might be nested objects like teams, timing, etc.)
      if (!valuesEqual(leftState[key], rightState[key])) {
        return false
      }
    }
  }

  // Now compare the keys in our list using deep comparison
  return stateKeysEqual(leftState, rightState, COMPARISON_KEYS.state)
}

/**
 * Compares session-related keys for session equality.
 * @param {Record<string, any>} leftSession
 * @param {Record<string, any>} rightSession
 * @returns {boolean}
 * @description Used for session migration comparison.
 */
export function sessionsEqual(leftSession, rightSession) {
  return stateKeysEqual(leftSession, rightSession, COMPARISON_KEYS.session)
}
