/**
 * @param {import('../utils/match-state.js').MatchState} matchState
 * @param {{ persistedMatchState?: { setsWon?: { teamA?: number, teamB?: number } } | null }} [options]
 */
export function createScoreViewModel(matchState, options = {}) {
  const resolvedSetsWon = resolveSetsWon(matchState, options.persistedMatchState)

  return {
    teamA: {
      label: matchState.teams.teamA.label,
      points: matchState.teamA.points,
      games: matchState.teamA.games
    },
    teamB: {
      label: matchState.teams.teamB.label,
      points: matchState.teamB.points,
      games: matchState.teamB.games
    },
    currentSet: matchState.currentSetStatus.number,
    currentSetGames: {
      teamA: matchState.currentSetStatus.teamAGames,
      teamB: matchState.currentSetStatus.teamBGames
    },
    setsWon: resolvedSetsWon,
    status: matchState.status
  }
}

function resolveSetsWon(matchState, persistedMatchState) {
  if (isRecord(matchState) && isRecord(matchState.setsWon)) {
    return {
      teamA: toNonNegativeInteger(matchState.setsWon.teamA),
      teamB: toNonNegativeInteger(matchState.setsWon.teamB)
    }
  }

  if (isRecord(persistedMatchState) && isRecord(persistedMatchState.setsWon)) {
    return {
      teamA: toNonNegativeInteger(persistedMatchState.setsWon.teamA),
      teamB: toNonNegativeInteger(persistedMatchState.setsWon.teamB)
    }
  }

  return {
    teamA: 0,
    teamB: 0
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null
}

function toNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0
}
