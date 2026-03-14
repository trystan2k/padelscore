import {
  createMatchHistoryEntry,
  MATCH_HISTORY_SCHEMA_VERSION
} from './match-history-types.js'
import { deleteState, loadState, saveState } from './persistence.js'

export const HISTORY_STORAGE_KEY = 'padel-buddy.match-history'
export const MAX_HISTORY_ENTRIES = 50

function isValidHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return false
  }

  const value = /** @type {any} */ (entry)

  return (
    typeof value.id === 'string' &&
    typeof value.completedAt === 'number' &&
    typeof value.teamALabel === 'string' &&
    typeof value.teamBLabel === 'string' &&
    typeof value.setsWonTeamA === 'number' &&
    typeof value.setsWonTeamB === 'number' &&
    Array.isArray(value.setHistory)
  )
}

function normalizeHistoryPayload(value) {
  if (Array.isArray(value)) {
    return {
      matches: value,
      schemaVersion: MATCH_HISTORY_SCHEMA_VERSION
    }
  }

  if (!value || typeof value !== 'object' || !Array.isArray(value.matches)) {
    return null
  }

  return {
    matches: value.matches,
    schemaVersion: MATCH_HISTORY_SCHEMA_VERSION
  }
}

function saveHistoryEntries(matches) {
  return saveState(HISTORY_STORAGE_KEY, {
    matches,
    schemaVersion: MATCH_HISTORY_SCHEMA_VERSION
  })
}

export function saveMatchToHistory(matchState) {
  if (!matchState || matchState.status !== 'finished') {
    return false
  }

  try {
    const newEntry = createMatchHistoryEntry(matchState)

    if (!newEntry) {
      return false
    }

    const history = loadMatchHistory()
    history.unshift(newEntry)

    while (history.length > MAX_HISTORY_ENTRIES) {
      history.pop()
    }

    return saveHistoryEntries(history)
  } catch {
    return false
  }
}

/**
 * @returns {Array<import('./match-history-types.js').MatchHistoryEntry>}
 */
export function loadMatchHistory() {
  const payload = loadState(HISTORY_STORAGE_KEY, {
    fallback: null,
    revive: normalizeHistoryPayload
  })

  if (!payload) {
    return []
  }

  return payload.matches.filter(isValidHistoryEntry)
}

/**
 * @param {string} matchId
 * @returns {import('./match-history-types.js').MatchHistoryEntry | null}
 */
export function loadMatchById(matchId) {
  if (!matchId || typeof matchId !== 'string') {
    return null
  }

  const history = loadMatchHistory()
  return history.find((entry) => entry.id === matchId) || null
}

export function clearMatchHistory() {
  return deleteState(HISTORY_STORAGE_KEY)
}

export function getMatchHistoryCount() {
  return loadMatchHistory().length
}

export function deleteMatchFromHistory(matchId) {
  if (!matchId || typeof matchId !== 'string') {
    return false
  }

  try {
    const history = loadMatchHistory()
    const filteredHistory = history.filter((entry) => entry.id !== matchId)

    if (filteredHistory.length === history.length) {
      return false
    }

    return saveHistoryEntries(filteredHistory)
  } catch {
    return false
  }
}
