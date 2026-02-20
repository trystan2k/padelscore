import { SCORE_POINTS } from './scoring-constants.js'

/**
 * @typedef {'active' | 'finished'} MatchStatus
 */

/**
 * @typedef TeamScore
 * @property {number | 'Ad' | 'Game'} points
 * @property {number} games
 */

/**
 * @typedef TeamConfiguration
 * @property {'teamA' | 'teamB'} id
 * @property {string} label
 */

/**
 * @typedef MatchTeamConfiguration
 * @property {TeamConfiguration} teamA
 * @property {TeamConfiguration} teamB
 */

/**
 * @typedef CurrentSetStatus
 * @property {number} number
 * @property {number} teamAGames
 * @property {number} teamBGames
 */

/**
 * @typedef MatchState
 * @property {MatchTeamConfiguration} teams
 * @property {TeamScore} teamA
 * @property {TeamScore} teamB
 * @property {CurrentSetStatus} currentSetStatus
 * @property {number} currentSet
 * @property {MatchStatus} status
 * @property {number} updatedAt
 */

export const MATCH_STATUS = Object.freeze({
  ACTIVE: 'active',
  FINISHED: 'finished'
})

/**
 * @returns {MatchTeamConfiguration}
 */
export function createInitialTeamConfiguration() {
  return {
    teamA: {
      id: 'teamA',
      label: 'Team A'
    },
    teamB: {
      id: 'teamB',
      label: 'Team B'
    }
  }
}

/**
 * @returns {CurrentSetStatus}
 */
export function createInitialCurrentSetStatus() {
  return {
    number: 1,
    teamAGames: 0,
    teamBGames: 0
  }
}

/**
 * @returns {TeamScore}
 */
export function createInitialTeamScore() {
  return {
    points: SCORE_POINTS.LOVE,
    games: 0
  }
}

/**
 * @param {number} [updatedAt=0]
 * @returns {MatchState}
 */
export function createInitialMatchState(updatedAt = 0) {
  const teamA = createInitialTeamScore()
  const teamB = createInitialTeamScore()
  const currentSetStatus = createInitialCurrentSetStatus()

  return {
    teams: createInitialTeamConfiguration(),
    teamA,
    teamB,
    currentSetStatus,
    // Legacy field kept for backward compatibility.
    currentSet: currentSetStatus.number,
    status: MATCH_STATUS.ACTIVE,
    updatedAt
  }
}
