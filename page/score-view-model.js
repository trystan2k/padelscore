/**
 * @param {import('../utils/match-state.js').MatchState} matchState
 */
export function createScoreViewModel(matchState) {
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
    status: matchState.status
  }
}
