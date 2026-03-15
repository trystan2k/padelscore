import { Time } from '@zos/sensor'

/**
 * Match History Type Definitions
 *
 * Type definitions for storing and displaying match history entries.
 */

/**
 * @typedef {'teamA' | 'teamB'} WinnerTeam
 */

/**
 * @typedef {Object} MatchHistoryEntry
 * @property {string} id - Unique identifier (timestamp-based)
 * @property {number} completedAt - Unix timestamp when match was completed (fallback)
 * @property {{year: number, month: number, day: number, hour: number, minute: number}|null} localTime - Local time from watch sensor
 * @property {string} teamALabel - Team A display label
 * @property {string} teamBLabel - Team B display label
 * @property {number} setsWonTeamA - Number of sets won by Team A
 * @property {number} setsWonTeamB - Number of sets won by Team B
 * @property {Array<{setNumber: number, teamAGames: number, teamBGames: number}>} setHistory - Array of set results
 * @property {WinnerTeam|null} winnerTeam - Which team won (null if draw/incomplete)
 * @property {number} schemaVersion - Schema version for migrations
 */

/**
 * @typedef {Object} MatchHistoryStorage
 * @property {MatchHistoryEntry[]} matches - Array of match history entries
 * @property {number} schemaVersion - Storage schema version
 */

export const MATCH_HISTORY_SCHEMA_VERSION = 1

/**
 * Creates a new match history entry from a finished match state.
 * @param {import('./match-state-schema.js').MatchState} matchState
 * @returns {MatchHistoryEntry|null}
 */
export function createMatchHistoryEntry(matchState) {
  if (!matchState || matchState.status !== 'finished') {
    return null
  }

  const setsWonTeamA = matchState.setsWon?.teamA ?? 0
  const setsWonTeamB = matchState.setsWon?.teamB ?? 0

  let winnerTeam = null
  if (setsWonTeamA > setsWonTeamB) {
    winnerTeam = 'teamA'
  } else if (setsWonTeamB > setsWonTeamA) {
    winnerTeam = 'teamB'
  }

  let timestamp = Date.now()
  let localTime = null

  try {
    const time = new Time()

    if (typeof time.getTime === 'function') {
      timestamp = time.getTime()
    }

    localTime = {
      year: time.getFullYear(),
      month: time.getMonth(),
      day: time.getDate(),
      hour: time.getHours(),
      minute: time.getMinutes()
    }
  } catch {
    try {
      const now = new Date(timestamp)
      localTime = {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes()
      }
    } catch {
      localTime = null
    }
  }

  return {
    id: String(timestamp),
    completedAt: timestamp,
    localTime,
    teamALabel: matchState.teams?.teamA?.label ?? 'Team A',
    teamBLabel: matchState.teams?.teamB?.label ?? 'Team B',
    setsWonTeamA,
    setsWonTeamB,
    setHistory: Array.isArray(matchState.setHistory)
      ? matchState.setHistory.map((entry) => ({
          setNumber: entry.setNumber,
          teamAGames: entry.teamAGames,
          teamBGames: entry.teamBGames
        }))
      : [],
    winnerTeam,
    schemaVersion: MATCH_HISTORY_SCHEMA_VERSION
  }
}
