import { describe, expect, it } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultMatchState,
  deserializeMatchSession,
  deserializeMatchState,
  isMatchState,
  MATCH_STATUS,
  migrateMatchState,
  readTimestampCandidate,
  SETS_NEEDED_TO_WIN,
  SETS_TO_PLAY,
  serializeMatchSession,
  serializeMatchState,
  toIsoTimestampSafe,
  validateMatchSession
} from '../../utils/match-state-schema.js'

describe('match-state-schema', () => {
  describe('MATCH_STATUS', () => {
    it('has ACTIVE status', () => {
      expect(MATCH_STATUS.ACTIVE).toBe('active')
    })

    it('has PAUSED status', () => {
      expect(MATCH_STATUS.PAUSED).toBe('paused')
    })

    it('has FINISHED status', () => {
      expect(MATCH_STATUS.FINISHED).toBe('finished')
    })
  })

  describe('SETS_TO_PLAY', () => {
    it('has ONE set option', () => {
      expect(SETS_TO_PLAY.ONE).toBe(1)
    })

    it('has THREE set option', () => {
      expect(SETS_TO_PLAY.THREE).toBe(3)
    })

    it('has FIVE set option', () => {
      expect(SETS_TO_PLAY.FIVE).toBe(5)
    })
  })

  describe('SETS_NEEDED_TO_WIN', () => {
    it('has ONE set needed option', () => {
      expect(SETS_NEEDED_TO_WIN.ONE).toBe(1)
    })

    it('has TWO sets needed option', () => {
      expect(SETS_NEEDED_TO_WIN.TWO).toBe(2)
    })

    it('has THREE sets needed option', () => {
      expect(SETS_NEEDED_TO_WIN.THREE).toBe(3)
    })
  })

  describe('CURRENT_SCHEMA_VERSION', () => {
    it('is a positive integer', () => {
      expect(CURRENT_SCHEMA_VERSION).toBeGreaterThan(0)
      expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true)
    })
  })

  describe('createDefaultMatchState', () => {
    it('creates state with ACTIVE status', () => {
      const state = createDefaultMatchState()
      expect(state.status).toBe(MATCH_STATUS.ACTIVE)
    })

    it('creates state with default sets configuration', () => {
      const state = createDefaultMatchState()
      expect(state.settings.setsToPlay).toBe(SETS_TO_PLAY.THREE)
      expect(state.settings.setsNeededToWin).toBe(SETS_NEEDED_TO_WIN.TWO)
    })

    it('creates state with zeroed scores', () => {
      const state = createDefaultMatchState()
      expect(state.scores.setsWon.teamA).toBe(0)
      expect(state.scores.setsWon.teamB).toBe(0)
      expect(state.scores.currentSet.number).toBe(1)
      expect(state.scores.currentSet.games.teamA).toBe(0)
      expect(state.scores.currentSet.games.teamB).toBe(0)
      expect(state.scores.currentGame.points.teamA).toBe(0)
      expect(state.scores.currentGame.points.teamB).toBe(0)
    })

    it('creates state with teams', () => {
      const state = createDefaultMatchState()
      expect(state.teams.teamA.id).toBe('teamA')
      expect(state.teams.teamA.label).toBe('Team A')
      expect(state.teams.teamB.id).toBe('teamB')
      expect(state.teams.teamB.label).toBe('Team B')
    })

    it('creates state with metadata', () => {
      const state = createDefaultMatchState()
      expect(state.metadata.matchId).toBeDefined()
      expect(state.metadata.matchId).toMatch(/^match-/)
    })

    it('creates state with timing', () => {
      const state = createDefaultMatchState()
      expect(state.timing.createdAt).toBeDefined()
      expect(state.timing.updatedAt).toBeDefined()
      expect(state.timing.startedAt).toBeDefined()
      expect(state.timing.finishedAt).toBe(null)
    })

    it('creates state with empty setHistory', () => {
      const state = createDefaultMatchState()
      expect(state.setHistory).toEqual([])
    })

    it('creates state with current schema version', () => {
      const state = createDefaultMatchState()
      expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('returns independent objects on each call', () => {
      const state1 = createDefaultMatchState()
      const state2 = createDefaultMatchState()

      state1.scores.setsWon.teamA = 1

      expect(state2.scores.setsWon.teamA).toBe(0)
    })
  })

  describe('isMatchState', () => {
    it('returns true for valid match state', () => {
      const state = createDefaultMatchState()
      expect(isMatchState(state)).toBe(true)
    })

    it('returns false for null', () => {
      expect(isMatchState(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isMatchState(undefined)).toBe(false)
    })

    it('returns false for invalid status', () => {
      const state = createDefaultMatchState()
      state.status = 'invalid'
      expect(isMatchState(state)).toBe(false)
    })

    it('returns false for invalid setsToPlay', () => {
      const state = createDefaultMatchState()
      state.setsToPlay = 2
      state.settings.setsToPlay = 2
      expect(isMatchState(state)).toBe(false)
    })
  })

  describe('validateMatchSession', () => {
    it('returns true for valid canonical match state', () => {
      const state = createDefaultMatchState()
      expect(validateMatchSession(state)).toBe(true)
    })

    it('returns false for invalid state', () => {
      expect(validateMatchSession(null)).toBe(false)
      expect(validateMatchSession({})).toBe(false)
    })
  })

  describe('serializeMatchSession and deserializeMatchSession', () => {
    it('round-trips canonical match state', () => {
      const original = createDefaultMatchState()
      const serialized = serializeMatchSession(original)
      const deserialized = deserializeMatchSession(serialized)

      expect(deserialized).not.toBeNull()
      expect(deserialized.status).toBe(original.status)
      expect(deserialized.schemaVersion).toBe(original.schemaVersion)
    })

    it('returns null for empty string', () => {
      expect(deserializeMatchSession('')).toBeNull()
    })

    it('returns null for non-string input', () => {
      expect(deserializeMatchSession(null)).toBeNull()
      expect(deserializeMatchSession(undefined)).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      expect(deserializeMatchSession('not json')).toBeNull()
    })
  })

  describe('serializeMatchState and deserializeMatchState', () => {
    it('round-trips match state', () => {
      const original = createDefaultMatchState()
      const serialized = serializeMatchState(original)
      const deserialized = deserializeMatchState(serialized)

      expect(deserialized).not.toBeNull()
      expect(deserialized.status).toBe(original.status)
    })
  })

  describe('migrateMatchState', () => {
    it('returns canonical state for valid input', () => {
      const state = createDefaultMatchState()
      const migrated = migrateMatchState(state)

      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('returns default state for null input', () => {
      const migrated = migrateMatchState(null)

      expect(migrated).toBeDefined()
      expect(migrated.status).toBe(MATCH_STATUS.ACTIVE)
    })

    it('returns default state for undefined input', () => {
      const migrated = migrateMatchState(undefined)

      expect(migrated).toBeDefined()
      expect(migrated.status).toBe(MATCH_STATUS.ACTIVE)
    })
  })

  describe('readTimestampCandidate', () => {
    it('returns non-negative integer as-is', () => {
      expect(readTimestampCandidate(1234567890)).toBe(1234567890)
      expect(readTimestampCandidate(0)).toBe(0)
    })

    it('returns null for negative integer', () => {
      expect(readTimestampCandidate(-1)).toBeNull()
    })

    it('returns null for non-integer number', () => {
      expect(readTimestampCandidate(1.5)).toBeNull()
    })

    it('returns null for non-number', () => {
      expect(readTimestampCandidate('123')).toBeNull()
      expect(readTimestampCandidate(null)).toBeNull()
      expect(readTimestampCandidate(undefined)).toBeNull()
    })
  })

  describe('toIsoTimestampSafe', () => {
    it('returns ISO string for valid timestamp', () => {
      const timestamp = 1234567890000
      const iso = toIsoTimestampSafe(timestamp)

      expect(typeof iso).toBe('string')
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('handles zero timestamp', () => {
      const iso = toIsoTimestampSafe(0)

      expect(typeof iso).toBe('string')
    })

    it('handles negative timestamp by clamping to 0', () => {
      const iso = toIsoTimestampSafe(-1000)

      expect(typeof iso).toBe('string')
    })
  })
})
