import { describe, expect, it } from 'vitest'
import {
  initializeMatchState,
  isSupportedSetsToPlay,
  SUPPORTED_SETS_TO_PLAY
} from '../../utils/match-session-init.js'
import { MATCH_STATUS } from '../../utils/match-state-schema.js'

describe('match-session-init', () => {
  describe('SUPPORTED_SETS_TO_PLAY', () => {
    it('contains 1', () => {
      expect(SUPPORTED_SETS_TO_PLAY).toContain(1)
    })

    it('contains 3', () => {
      expect(SUPPORTED_SETS_TO_PLAY).toContain(3)
    })

    it('contains 5', () => {
      expect(SUPPORTED_SETS_TO_PLAY).toContain(5)
    })

    it('has exactly 3 options', () => {
      expect(SUPPORTED_SETS_TO_PLAY).toHaveLength(3)
    })
  })

  describe('isSupportedSetsToPlay', () => {
    it('returns true for 1', () => {
      expect(isSupportedSetsToPlay(1)).toBe(true)
    })

    it('returns true for 3', () => {
      expect(isSupportedSetsToPlay(3)).toBe(true)
    })

    it('returns true for 5', () => {
      expect(isSupportedSetsToPlay(5)).toBe(true)
    })

    it('returns false for 2', () => {
      expect(isSupportedSetsToPlay(2)).toBe(false)
    })

    it('returns false for 7', () => {
      expect(isSupportedSetsToPlay(7)).toBe(false)
    })

    it('returns false for 0', () => {
      expect(isSupportedSetsToPlay(0)).toBe(false)
    })

    it('returns false for negative numbers', () => {
      expect(isSupportedSetsToPlay(-1)).toBe(false)
    })

    it('returns false for non-integers', () => {
      expect(isSupportedSetsToPlay(3.5)).toBe(false)
      expect(isSupportedSetsToPlay('3')).toBe(false)
      expect(isSupportedSetsToPlay(null)).toBe(false)
      expect(isSupportedSetsToPlay(undefined)).toBe(false)
    })
  })

  describe('initializeMatchState', () => {
    it('creates active match state for 1-set match', () => {
      const state = initializeMatchState(1)

      expect(state.status).toBe(MATCH_STATUS.ACTIVE)
      expect(state.setsToPlay).toBe(1)
      expect(state.setsNeededToWin).toBe(1)
    })

    it('creates active match state for 3-set match', () => {
      const state = initializeMatchState(3)

      expect(state.status).toBe(MATCH_STATUS.ACTIVE)
      expect(state.setsToPlay).toBe(3)
      expect(state.setsNeededToWin).toBe(2)
    })

    it('creates active match state for 5-set match', () => {
      const state = initializeMatchState(5)

      expect(state.status).toBe(MATCH_STATUS.ACTIVE)
      expect(state.setsToPlay).toBe(5)
      expect(state.setsNeededToWin).toBe(3)
    })

    it('computes setsNeededToWin using ceiling division', () => {
      expect(initializeMatchState(1).setsNeededToWin).toBe(1)
      expect(initializeMatchState(3).setsNeededToWin).toBe(2)
      expect(initializeMatchState(5).setsNeededToWin).toBe(3)
    })

    it('initializes setsWon to 0-0', () => {
      const state = initializeMatchState(3)

      expect(state.setsWon.teamA).toBe(0)
      expect(state.setsWon.teamB).toBe(0)
      expect(state.scores.setsWon.teamA).toBe(0)
      expect(state.scores.setsWon.teamB).toBe(0)
    })

    it('initializes currentSet to set 1 with 0-0 games', () => {
      const state = initializeMatchState(3)

      expect(state.currentSet.number).toBe(1)
      expect(state.currentSet.games.teamA).toBe(0)
      expect(state.currentSet.games.teamB).toBe(0)
      expect(state.scores.currentSet.number).toBe(1)
    })

    it('initializes currentGame to 0-0 points', () => {
      const state = initializeMatchState(3)

      expect(state.currentGame.points.teamA).toBe(0)
      expect(state.currentGame.points.teamB).toBe(0)
      expect(state.scores.currentGame.points.teamA).toBe(0)
    })

    it('initializes empty setHistory', () => {
      const state = initializeMatchState(3)

      expect(state.setHistory).toEqual([])
    })

    it('sets timing fields', () => {
      const state = initializeMatchState(3)

      expect(state.timing).toBeDefined()
      expect(state.timing.createdAt).toBeDefined()
      expect(state.timing.updatedAt).toBeDefined()
      expect(state.timing.startedAt).toBeDefined()
      expect(state.timing.finishedAt).toBe(null)
    })

    it('throws TypeError for invalid setsToPlay values', () => {
      expect(() => initializeMatchState(2)).toThrow(TypeError)
      expect(() => initializeMatchState(7)).toThrow(TypeError)
      expect(() => initializeMatchState(0)).toThrow(TypeError)
    })

    it('throws TypeError with descriptive message for non-integer input', () => {
      expect(() => initializeMatchState(3.5)).toThrow(TypeError)
      expect(() => initializeMatchState('3')).toThrow(TypeError)
    })

    it('throws TypeError for null input', () => {
      expect(() => initializeMatchState(null)).toThrow(TypeError)
    })

    it('throws TypeError for undefined input', () => {
      expect(() => initializeMatchState(undefined)).toThrow(TypeError)
    })

    it('returns independent state objects for each call', () => {
      const state1 = initializeMatchState(3)
      const state2 = initializeMatchState(3)

      state1.setsWon.teamA = 1
      state1.currentSet.games.teamA = 5

      expect(state2.setsWon.teamA).toBe(0)
      expect(state2.currentSet.games.teamA).toBe(0)
    })

    it('returns detached canonical and mirror score objects', () => {
      const state = initializeMatchState(3)

      state.scores.setsWon.teamA = 1
      state.scores.currentSet.games.teamA = 5
      state.scores.currentGame.points.teamA = 15

      expect(state.setsWon.teamA).toBe(0)
      expect(state.currentSet.games.teamA).toBe(0)
      expect(state.currentGame.points.teamA).toBe(0)
    })

    it('sets settings to match setsToPlay and setsNeededToWin', () => {
      const state = initializeMatchState(3)

      expect(state.settings.setsToPlay).toBe(3)
      expect(state.settings.setsNeededToWin).toBe(2)
    })

    it('creates team configuration', () => {
      const state = initializeMatchState(3)

      expect(state.teams.teamA.id).toBe('teamA')
      expect(state.teams.teamA.label).toBe('Team A')
      expect(state.teams.teamB.id).toBe('teamB')
      expect(state.teams.teamB.label).toBe('Team B')
    })

    it('creates metadata with matchId', () => {
      const state = initializeMatchState(3)

      expect(state.metadata.matchId).toBeDefined()
      expect(typeof state.metadata.matchId).toBe('string')
      expect(state.metadata.matchId).toMatch(/^match-/)
    })

    it('sets schemaVersion', () => {
      const state = initializeMatchState(3)

      expect(state.schemaVersion).toBeDefined()
      expect(typeof state.schemaVersion).toBe('number')
    })
  })
})
