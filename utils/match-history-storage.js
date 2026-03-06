/**
 * Match History Storage Service
 *
 * Provides persistent storage for match history using hmFS file system.
 * Maximum 50 matches with FIFO deletion.
 */

import {
  resolveFsReadOnlyFlag,
  resolveFsWriteCreateTruncateFlags
} from './constants.js'
import {
  createMatchHistoryEntry,
  MATCH_HISTORY_SCHEMA_VERSION
} from './match-history-types.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const HISTORY_STORAGE_KEY = 'padel-buddy.match-history'
export const MAX_HISTORY_ENTRIES = 50

// ---------------------------------------------------------------------------
// UTF-8 encode / decode helpers
// (TextEncoder/TextDecoder are not available in Zepp OS v1.0)
// ---------------------------------------------------------------------------

/**
 * Encode a JS string to a Uint8Array of UTF-8 bytes.
 * @param {string} str
 * @returns {Uint8Array}
 */
function encodeUtf8(str) {
  const bytes = []

  for (let i = 0; i < str.length; i += 1) {
    let code = str.charCodeAt(i)

    // Handle UTF-16 surrogate pairs
    if (code >= 0xd800 && code <= 0xdbff) {
      const hi = code
      const lo = str.charCodeAt(i + 1)

      if (lo >= 0xdc00 && lo <= 0xdfff) {
        code = ((hi - 0xd800) << 10) + (lo - 0xdc00) + 0x10000
        i += 1
      }
    }

    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      )
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      )
    }
  }

  return new Uint8Array(bytes)
}

/**
 * Decode a Uint8Array of UTF-8 bytes to a JS string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function decodeUtf8(bytes) {
  let str = ''
  let i = 0

  while (i < bytes.length) {
    const byte = bytes[i]
    let code

    if (byte < 0x80) {
      code = byte
      i += 1
    } else if ((byte & 0xe0) === 0xc0) {
      code = ((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f)
      i += 2
    } else if ((byte & 0xf0) === 0xe0) {
      code =
        ((byte & 0x0f) << 12) |
        ((bytes[i + 1] & 0x3f) << 6) |
        (bytes[i + 2] & 0x3f)
      i += 3
    } else {
      code =
        ((byte & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f)
      i += 4
    }

    if (code >= 0x10000) {
      const offset = code - 0x10000
      str += String.fromCharCode(
        0xd800 + (offset >> 10),
        0xdc00 + (offset & 0x3ff)
      )
    } else {
      str += String.fromCharCode(code)
    }
  }

  return str
}

/**
 * Converts a storage key to a safe filename for the /data directory.
 * @param {string} key
 * @returns {string}
 */
export function keyToFilename(key) {
  return `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`
}

/**
 * Check if hmFS is available.
 * @returns {boolean}
 */
function isHmFsAvailable() {
  return (
    typeof hmFS !== 'undefined' &&
    typeof hmFS.open === 'function' &&
    typeof hmFS.close === 'function' &&
    typeof hmFS.read === 'function' &&
    typeof hmFS.write === 'function'
  )
}

/**
 * Save data to a file using hmFS.
 * @param {string} filename
 * @param {string} data
 * @returns {boolean}
 */
export function saveToFile(filename, data) {
  if (!isHmFsAvailable()) {
    return false
  }

  let fileId = -1

  try {
    const encoded = encodeUtf8(data)
    const writeFlags = resolveFsWriteCreateTruncateFlags(hmFS)
    fileId = hmFS.open(filename, writeFlags)

    if (fileId < 0) {
      return false
    }

    const writeResult = hmFS.write(fileId, encoded.buffer, 0, encoded.length)
    return writeResult >= 0
  } catch {
    return false
  } finally {
    if (fileId >= 0) {
      try {
        hmFS.close(fileId)
      } catch {
        // Ignore close errors.
      }
    }
  }
}

/**
 * Load data from a file using hmFS.
 * @param {string} filename
 * @returns {string|null}
 */
export function loadFromFile(filename) {
  if (!isHmFsAvailable()) {
    return null
  }

  let fileId = -1

  try {
    // hmFS.stat returns [stat_info, error_code] per the v1.0 API spec.
    const [statInfo, statErr] = hmFS.stat(filename)

    if (statErr !== 0 || !statInfo || statInfo.size <= 0) {
      return null
    }

    const size = statInfo.size
    const readFlag = resolveFsReadOnlyFlag(hmFS)
    fileId = hmFS.open(filename, readFlag)

    if (fileId < 0) {
      return null
    }

    const buffer = new Uint8Array(size)
    const readResult = hmFS.read(fileId, buffer.buffer, 0, size)

    if (readResult < 0) {
      return null
    }

    const str = decodeUtf8(buffer)
    return str.length > 0 ? str : null
  } catch {
    return null
  } finally {
    if (fileId >= 0) {
      try {
        hmFS.close(fileId)
      } catch {
        // Ignore close errors.
      }
    }
  }
}

/**
 * Validate a match history entry.
 * @param {unknown} entry
 * @returns {boolean}
 */
function isValidHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return false
  }

  const e = /** @type {any} */ (entry)

  return (
    typeof e.id === 'string' &&
    typeof e.completedAt === 'number' &&
    typeof e.teamALabel === 'string' &&
    typeof e.teamBLabel === 'string' &&
    typeof e.setsWonTeamA === 'number' &&
    typeof e.setsWonTeamB === 'number' &&
    Array.isArray(e.setHistory)
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save a finished match to history.
 * @param {import('./match-state-schema.js').MatchState} matchState
 * @returns {boolean} True if saved successfully
 */
export function saveMatchToHistory(matchState) {
  if (!matchState || matchState.status !== 'finished') {
    return false
  }

  try {
    // Create history entry from match state
    const newEntry = createMatchHistoryEntry(matchState)

    if (!newEntry) {
      return false
    }

    // Load existing history
    const history = loadMatchHistory()

    // Add new entry at the beginning (most recent first)
    history.unshift(newEntry)

    // Enforce max limit - remove oldest entries (from the end)
    while (history.length > MAX_HISTORY_ENTRIES) {
      history.pop()
    }

    // Save back to storage
    const storageData = {
      matches: history,
      schemaVersion: MATCH_HISTORY_SCHEMA_VERSION
    }

    const filename = keyToFilename(HISTORY_STORAGE_KEY)
    return saveToFile(filename, JSON.stringify(storageData))
  } catch {
    return false
  }
}

/**
 * Load all match history entries.
 * @returns {Array<import('./match-history-types.js').MatchHistoryEntry>}
 */
export function loadMatchHistory() {
  try {
    const filename = keyToFilename(HISTORY_STORAGE_KEY)
    const data = loadFromFile(filename)

    if (!data) {
      return []
    }

    const parsed = JSON.parse(data)

    if (!parsed || !Array.isArray(parsed.matches)) {
      return []
    }

    // Validate and filter entries
    const validEntries = parsed.matches.filter(isValidHistoryEntry)

    return validEntries
  } catch {
    // Corrupted file - return empty array
    return []
  }
}

/**
 * Load a specific match by ID.
 * @param {string} matchId
 * @returns {import('./match-history-types.js').MatchHistoryEntry|null}
 */
export function loadMatchById(matchId) {
  if (!matchId || typeof matchId !== 'string') {
    return null
  }

  const history = loadMatchHistory()
  return history.find((entry) => entry.id === matchId) || null
}

/**
 * Clear all match history.
 * @returns {boolean} True if cleared successfully
 */
export function clearMatchHistory() {
  try {
    if (!isHmFsAvailable()) {
      return false
    }

    const filename = keyToFilename(HISTORY_STORAGE_KEY)
    hmFS.remove(filename)
    return true
  } catch {
    return false
  }
}

/**
 * Get the number of matches in history.
 * @returns {number}
 */
export function getMatchHistoryCount() {
  return loadMatchHistory().length
}

/**
 * Delete a specific match from history by ID.
 * @param {string} matchId - The ID of the match to delete
 * @returns {boolean} True if deleted successfully
 */
export function deleteMatchFromHistory(matchId) {
  if (!matchId || typeof matchId !== 'string') {
    return false
  }

  try {
    // Load existing history
    const history = loadMatchHistory()

    // Filter out the match to delete
    const filteredHistory = history.filter((entry) => entry.id !== matchId)

    // If no match was removed, return false
    if (filteredHistory.length === history.length) {
      return false
    }

    // Save updated history
    const storageData = {
      matches: filteredHistory,
      schemaVersion: MATCH_HISTORY_SCHEMA_VERSION
    }

    const filename = keyToFilename(HISTORY_STORAGE_KEY)
    return saveToFile(filename, JSON.stringify(storageData))
  } catch {
    return false
  }
}
