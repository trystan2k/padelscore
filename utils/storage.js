import { MATCH_STATUS } from './match-state.js'
import { SCORE_POINT_SEQUENCE } from './scoring-constants.js'

// ---------------------------------------------------------------------------
// hmFS flag constants (POSIX values — used as fallback if hmFS.O_* are undefined)
// ---------------------------------------------------------------------------
const FS_O_RDONLY = 0
const FS_O_WRONLY = 1
const FS_O_CREAT = 64 // 0x40
const FS_O_TRUNC = 512 // 0x200

export const MATCH_STATE_STORAGE_KEY = 'padel-buddy.match-state'
export const LEGACY_MATCH_STATE_STORAGE_KEY = MATCH_STATE_STORAGE_KEY

const scorePointSet = new Set(SCORE_POINT_SEQUENCE)
const fallbackStorage = createInMemoryStorageAdapter()

/**
 * @returns {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null | undefined), removeItem: (key: string) => void }}
 */
function getSettingsStorage() {
  const runtimeStorage = resolveRuntimeStorage()

  if (runtimeStorage) {
    return runtimeStorage
  }

  return fallbackStorage
}

/**
 * @param {import('./match-state.js').MatchState} state
 */
export function saveState(state) {
  const serializedState = JSON.stringify(state)
  getSettingsStorage().setItem(MATCH_STATE_STORAGE_KEY, serializedState)
}

/**
 * @returns {import('./match-state.js').MatchState | null}
 */
export function loadState() {
  const serializedState = getSettingsStorage().getItem(MATCH_STATE_STORAGE_KEY)

  if (!serializedState) {
    return null
  }

  try {
    const parsedState = JSON.parse(serializedState)
    return isMatchState(parsedState) ? parsedState : null
  } catch {
    return null
  }
}

export function clearState() {
  getSettingsStorage().removeItem(MATCH_STATE_STORAGE_KEY)
}

/**
 * @returns {import('./match-state.js').MatchState | null}
 */
export function loadLegacyActiveSession() {
  return loadState()
}

export function clearLegacyActiveSession() {
  clearState()
}

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
function keyToFilename(key) {
  return `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`
}

/**
 * Returns a storage adapter backed by hmFS file I/O (persistent /data directory).
 * Data written here survives system reboots, unlike SysProSetChars which is
 * documented as "temporary — system reboot will clear".
 *
 * @returns {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null), removeItem: (key: string) => void } | null}
 */
function resolveRuntimeStorage() {
  if (
    typeof hmFS !== 'undefined' &&
    typeof hmFS.open === 'function' &&
    typeof hmFS.close === 'function' &&
    typeof hmFS.read === 'function' &&
    typeof hmFS.write === 'function'
  ) {
    return createHmFsFileStorageAdapter()
  }

  return null
}

/**
 * Creates a storage adapter backed by hmFS file I/O in the /data directory.
 * @returns {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null), removeItem: (key: string) => void }}
 */
function createHmFsFileStorageAdapter() {
  return {
    setItem(key, value) {
      let fileId = -1

      try {
        const filename = keyToFilename(key)
        const encoded = encodeUtf8(value)
        const writeFlags =
          (typeof hmFS.O_WRONLY === 'number' ? hmFS.O_WRONLY : FS_O_WRONLY) |
          (typeof hmFS.O_CREAT === 'number' ? hmFS.O_CREAT : FS_O_CREAT) |
          (typeof hmFS.O_TRUNC === 'number' ? hmFS.O_TRUNC : FS_O_TRUNC)
        fileId = hmFS.open(filename, writeFlags)

        if (fileId < 0) {
          return
        }

        hmFS.write(fileId, encoded.buffer, 0, encoded.length)
      } catch {
        // Ignore storage write errors so app runtime does not crash.
      } finally {
        if (fileId >= 0) {
          try {
            hmFS.close(fileId)
          } catch {
            // Ignore close errors.
          }
        }
      }
    },

    getItem(key) {
      let fileId = -1

      try {
        const filename = keyToFilename(key)
        // hmFS.stat returns [stat_info, error_code] per the v1.0 API spec.
        const [statInfo, statErr] = hmFS.stat(filename)

        if (statErr !== 0 || !statInfo || statInfo.size <= 0) {
          return null
        }

        const size = statInfo.size
        const readFlag =
          typeof hmFS.O_RDONLY === 'number' ? hmFS.O_RDONLY : FS_O_RDONLY
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
    },

    removeItem(key) {
      try {
        const filename = keyToFilename(key)
        hmFS.remove(filename)
      } catch {
        // Ignore storage delete errors so app runtime does not crash.
      }
    }
  }
}

/**
 * @returns {{ setItem: (key: string, value: string) => void, getItem: (key: string) => (string | null), removeItem: (key: string) => void }}
 */
function createInMemoryStorageAdapter() {
  const memoryStorage = new Map()

  return {
    setItem(key, value) {
      memoryStorage.set(key, value)
    },
    getItem(key) {
      return memoryStorage.has(key) ? memoryStorage.get(key) : null
    },
    removeItem(key) {
      memoryStorage.delete(key)
    }
  }
}

/**
 * @param {unknown} value
 * @returns {value is import('./match-state.js').MatchState}
 */
function isMatchState(value) {
  if (!isRecord(value)) {
    return false
  }

  return (
    isMatchTeamConfiguration(value.teams) &&
    isTeamScore(value.teamA) &&
    isTeamScore(value.teamB) &&
    isCurrentSetStatus(value.currentSetStatus) &&
    isNonNegativeInteger(value.currentSet) &&
    isMatchStatus(value.status) &&
    isFiniteNumber(value.updatedAt)
  )
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null
}

/**
 * @param {unknown} value
 * @returns {value is import('./match-state.js').TeamScore}
 */
function isTeamScore(value) {
  return (
    isRecord(value) &&
    scorePointSet.has(value.points) &&
    isNonNegativeInteger(value.games)
  )
}

/**
 * @param {unknown} value
 * @returns {value is import('./match-state.js').MatchTeamConfiguration}
 */
function isMatchTeamConfiguration(value) {
  return (
    isRecord(value) &&
    isTeamConfiguration(value.teamA, 'teamA') &&
    isTeamConfiguration(value.teamB, 'teamB')
  )
}

/**
 * @param {unknown} value
 * @param {'teamA' | 'teamB'} expectedId
 * @returns {value is import('./match-state.js').TeamConfiguration}
 */
function isTeamConfiguration(value, expectedId) {
  return (
    isRecord(value) &&
    value.id === expectedId &&
    typeof value.label === 'string'
  )
}

/**
 * @param {unknown} value
 * @returns {value is import('./match-state.js').CurrentSetStatus}
 */
function isCurrentSetStatus(value) {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.number) &&
    isNonNegativeInteger(value.teamAGames) &&
    isNonNegativeInteger(value.teamBGames)
  )
}

/**
 * @param {unknown} value
 * @returns {value is import('./match-state.js').MatchStatus}
 */
function isMatchStatus(value) {
  return value === MATCH_STATUS.ACTIVE || value === MATCH_STATUS.FINISHED
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}
