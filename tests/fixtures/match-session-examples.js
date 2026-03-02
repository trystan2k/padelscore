const TEAM_A = 'teamA'
const TEAM_B = 'teamB'

function createSession({
  matchId,
  status,
  setsToPlay,
  setsNeededToWin,
  setsWon,
  currentSet,
  currentGame,
  setHistory,
  teamALabel,
  teamBLabel,
  createdAt,
  updatedAt,
  startedAt,
  finishedAt,
  winnerTeam,
  completedAt
}) {
  const scores = {
    setsWon,
    currentSet,
    currentGame
  }

  const session = {
    teams: {
      teamA: {
        id: TEAM_A,
        label: teamALabel
      },
      teamB: {
        id: TEAM_B,
        label: teamBLabel
      }
    },
    scores,
    settings: {
      setsToPlay,
      setsNeededToWin
    },
    status,
    metadata: {
      matchId
    },
    timing: {
      createdAt,
      updatedAt,
      startedAt,
      finishedAt
    },
    setHistory,
    schemaVersion: 2,
    setsToPlay,
    setsNeededToWin,
    setsWon,
    currentSet,
    currentGame,
    updatedAt: Date.parse(updatedAt)
  }

  if (winnerTeam) {
    session.winnerTeam = winnerTeam
    session.winner = { team: winnerTeam }
  }

  if (typeof completedAt === 'number') {
    session.completedAt = completedAt
  }

  return session
}

export const emptyNewSession = createSession({
  matchId: 'match-1704067200000',
  status: 'active',
  setsToPlay: 3,
  setsNeededToWin: 2,
  setsWon: { teamA: 0, teamB: 0 },
  currentSet: {
    number: 1,
    games: { teamA: 0, teamB: 0 }
  },
  currentGame: {
    points: { teamA: 0, teamB: 0 }
  },
  setHistory: [],
  teamALabel: 'Team A',
  teamBLabel: 'Team B',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  startedAt: '2024-01-01T00:00:00.000Z',
  finishedAt: null
})

export const activeInProgressSession = createSession({
  matchId: 'match-1704067800000',
  status: 'active',
  setsToPlay: 3,
  setsNeededToWin: 2,
  setsWon: { teamA: 1, teamB: 0 },
  currentSet: {
    number: 2,
    games: { teamA: 4, teamB: 3 }
  },
  currentGame: {
    points: { teamA: 30, teamB: 15 }
  },
  setHistory: [{ setNumber: 1, teamAGames: 6, teamBGames: 4 }],
  teamALabel: 'Serve Masters',
  teamBLabel: 'Court Kings',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:10:00.000Z',
  startedAt: '2024-01-01T00:00:30.000Z',
  finishedAt: null
})

export const finishedSessionWithHistory = createSession({
  matchId: 'match-1704069000000',
  status: 'finished',
  setsToPlay: 3,
  setsNeededToWin: 2,
  setsWon: { teamA: 2, teamB: 1 },
  currentSet: {
    number: 3,
    games: { teamA: 6, teamB: 2 }
  },
  currentGame: {
    points: { teamA: 0, teamB: 0 }
  },
  setHistory: [
    { setNumber: 1, teamAGames: 6, teamBGames: 4 },
    { setNumber: 2, teamAGames: 4, teamBGames: 6 },
    { setNumber: 3, teamAGames: 6, teamBGames: 2 }
  ],
  teamALabel: 'Team A',
  teamBLabel: 'Team B',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:30:00.000Z',
  startedAt: '2024-01-01T00:00:30.000Z',
  finishedAt: '2024-01-01T00:30:00.000Z',
  winnerTeam: TEAM_A,
  completedAt: Date.parse('2024-01-01T00:30:00.000Z')
})

export const specialCharacterTeamNamesSession = createSession({
  matchId: 'match-1704070200000',
  status: 'paused',
  setsToPlay: 1,
  setsNeededToWin: 1,
  setsWon: { teamA: 0, teamB: 0 },
  currentSet: {
    number: 1,
    games: { teamA: 2, teamB: 2 }
  },
  currentGame: {
    points: { teamA: 15, teamB: 15 }
  },
  setHistory: [],
  teamALabel: 'Niño 🎾',
  teamBLabel: 'São Paulo 😊',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:50:00.000Z',
  startedAt: '2024-01-01T00:00:30.000Z',
  finishedAt: null
})
