import { describe, expect, it } from 'vitest'
import {
  createMatchHistoryEntry,
  MATCH_HISTORY_SCHEMA_VERSION
} from '../../utils/match-history-types.js'

const createFinishedMatchState = (overrides = {}) => ({
  status: 'finished',
  setsWon: { teamA: 2, teamB: 1 },
  teams: {
    teamA: { label: 'Team Alpha' },
    teamB: { label: 'Team Beta' }
  },
  setHistory: [
    { setNumber: 1, teamAGames: 6, teamBGames: 4 },
    { setNumber: 2, teamAGames: 4, teamBGames: 6 },
    { setNumber: 3, teamAGames: 6, teamBGames: 2 }
  ],
  ...overrides
})

describe('MATCH_HISTORY_SCHEMA_VERSION', () => {
  it('is defined as 1', () => {
    expect(MATCH_HISTORY_SCHEMA_VERSION).toBe(1)
  })
})

describe('createMatchHistoryEntry', () => {
  it('returns null for null matchState', () => {
    expect(createMatchHistoryEntry(null)).toBe(null)
  })

  it('returns null for undefined matchState', () => {
    expect(createMatchHistoryEntry(undefined)).toBe(null)
  })

  it('returns null for non-finished status', () => {
    expect(createMatchHistoryEntry({ status: 'playing' })).toBe(null)
    expect(createMatchHistoryEntry({ status: 'paused' })).toBe(null)
    expect(createMatchHistoryEntry({ status: 'pending' })).toBe(null)
  })

  it('returns null for missing status', () => {
    expect(createMatchHistoryEntry({})).toBe(null)
  })

  it('creates entry for finished match', () => {
    const state = createFinishedMatchState()
    const entry = createMatchHistoryEntry(state)

    expect(entry).not.toBe(null)
    expect(typeof entry.id).toBe('string')
    expect(typeof entry.completedAt).toBe('number')
    expect(entry.schemaVersion).toBe(MATCH_HISTORY_SCHEMA_VERSION)
  })

  describe('winnerTeam determination', () => {
    it('sets winnerTeam to teamA when teamA has more sets', () => {
      const state = createFinishedMatchState({
        setsWon: { teamA: 2, teamB: 0 }
      })
      const entry = createMatchHistoryEntry(state)
      expect(entry.winnerTeam).toBe('teamA')
    })

    it('sets winnerTeam to teamB when teamB has more sets', () => {
      const state = createFinishedMatchState({
        setsWon: { teamA: 0, teamB: 2 }
      })
      const entry = createMatchHistoryEntry(state)
      expect(entry.winnerTeam).toBe('teamB')
    })

    it('sets winnerTeam to null for draw', () => {
      const state = createFinishedMatchState({
        setsWon: { teamA: 1, teamB: 1 }
      })
      const entry = createMatchHistoryEntry(state)
      expect(entry.winnerTeam).toBe(null)
    })

    it('sets winnerTeam to null when setsWon is missing', () => {
      const state = createFinishedMatchState({ setsWon: undefined })
      const entry = createMatchHistoryEntry(state)
      expect(entry.winnerTeam).toBe(null)
    })

    it('handles missing teamA in setsWon', () => {
      const state = createFinishedMatchState({
        setsWon: { teamB: 2 }
      })
      const entry = createMatchHistoryEntry(state)
      expect(entry.winnerTeam).toBe('teamB')
    })

    it('handles missing teamB in setsWon', () => {
      const state = createFinishedMatchState({
        setsWon: { teamA: 2 }
      })
      const entry = createMatchHistoryEntry(state)
      expect(entry.winnerTeam).toBe('teamA')
    })
  })

  describe('setsWon extraction', () => {
    it('extracts setsWonTeamA and setsWonTeamB', () => {
      const state = createFinishedMatchState({
        setsWon: { teamA: 2, teamB: 1 }
      })
      const entry = createMatchHistoryEntry(state)
      expect(entry.setsWonTeamA).toBe(2)
      expect(entry.setsWonTeamB).toBe(1)
    })

    it('defaults to 0 when setsWon is missing', () => {
      const state = createFinishedMatchState({ setsWon: undefined })
      const entry = createMatchHistoryEntry(state)
      expect(entry.setsWonTeamA).toBe(0)
      expect(entry.setsWonTeamB).toBe(0)
    })
  })

  describe('team labels', () => {
    it('uses custom team labels', () => {
      const state = createFinishedMatchState({
        teams: {
          teamA: { label: 'Los Leones' },
          teamB: { label: 'Los Tigres' }
        }
      })
      const entry = createMatchHistoryEntry(state)
      expect(entry.teamALabel).toBe('Los Leones')
      expect(entry.teamBLabel).toBe('Los Tigres')
    })

    it('defaults to "Team A" and "Team B" when teams missing', () => {
      const state = createFinishedMatchState({ teams: undefined })
      const entry = createMatchHistoryEntry(state)
      expect(entry.teamALabel).toBe('Team A')
      expect(entry.teamBLabel).toBe('Team B')
    })

    it('defaults when team label is missing', () => {
      const state = createFinishedMatchState({
        teams: { teamA: {}, teamB: {} }
      })
      const entry = createMatchHistoryEntry(state)
      expect(entry.teamALabel).toBe('Team A')
      expect(entry.teamBLabel).toBe('Team B')
    })

    it('handles partial teams object', () => {
      const state = createFinishedMatchState({
        teams: { teamA: { label: 'Only A' } }
      })
      const entry = createMatchHistoryEntry(state)
      expect(entry.teamALabel).toBe('Only A')
      expect(entry.teamBLabel).toBe('Team B')
    })
  })

  describe('setHistory', () => {
    it('copies set history from match state', () => {
      const state = createFinishedMatchState()
      const entry = createMatchHistoryEntry(state)

      expect(entry.setHistory).toHaveLength(3)
      expect(entry.setHistory[0]).toEqual({
        setNumber: 1,
        teamAGames: 6,
        teamBGames: 4
      })
    })

    it('returns empty array when setHistory is missing', () => {
      const state = createFinishedMatchState({ setHistory: undefined })
      const entry = createMatchHistoryEntry(state)
      expect(entry.setHistory).toEqual([])
    })

    it('returns empty array when setHistory is not an array', () => {
      const state = createFinishedMatchState({ setHistory: 'invalid' })
      const entry = createMatchHistoryEntry(state)
      expect(entry.setHistory).toEqual([])
    })

    it('creates a copy of set history (not same reference)', () => {
      const state = createFinishedMatchState()
      const entry = createMatchHistoryEntry(state)
      expect(entry.setHistory).not.toBe(state.setHistory)
    })
  })

  describe('localTime', () => {
    it('includes localTime object with expected properties', () => {
      const state = createFinishedMatchState()
      const entry = createMatchHistoryEntry(state)

      expect(entry.localTime).not.toBe(null)
      expect(typeof entry.localTime.year).toBe('number')
      expect(typeof entry.localTime.month).toBe('number')
      expect(typeof entry.localTime.day).toBe('number')
      expect(typeof entry.localTime.hour).toBe('number')
      expect(typeof entry.localTime.minute).toBe('number')
    })
  })

  describe('id generation', () => {
    it('uses timestamp as string for id', () => {
      const state = createFinishedMatchState()
      const entry = createMatchHistoryEntry(state)
      expect(entry.id).toBe(String(entry.completedAt))
      expect(typeof entry.id).toBe('string')
    })
  })
})
