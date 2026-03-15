/**
 * Unification Regression Suite - Schema Validation Unit Tests
 *
 * Validates canonical schema behavior including:
 * - Canonical schema validation
 * - Empty storage handling
 * - Corrupt payload handling
 * - UTF-8 label support
 * - matchStartTime initialization and immutability
 */

import { describe, expect, it } from 'vitest'

import {
  CURRENT_SCHEMA_VERSION,
  createDefaultMatchState,
  deserializeMatchSession,
  MATCH_STATUS,
  SETS_NEEDED_TO_WIN,
  SETS_TO_PLAY,
  serializeMatchState,
  validateMatchSession
} from '../../utils/match-state-schema.js'
import {
  activeInProgressSession,
  emptyNewSession,
  finishedSessionWithHistory,
  specialCharacterTeamNamesSession
} from '../fixtures/match-session-examples.js'

describe('Canonical Schema Validation', () => {
  it('validateMatchSession accepts all canonical fixture examples', () => {
    expect(validateMatchSession(emptyNewSession)).toBe(true)
    expect(validateMatchSession(activeInProgressSession)).toBe(true)
    expect(validateMatchSession(finishedSessionWithHistory)).toBe(true)
    expect(validateMatchSession(specialCharacterTeamNamesSession)).toBe(true)
  })

  it('createDefaultMatchState produces schema-valid state with all required fields', () => {
    const state = createDefaultMatchState()

    expect(validateMatchSession(state)).toBe(true)
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(state.status).toBe(MATCH_STATUS.ACTIVE)
    expect(state.setsToPlay).toBe(SETS_TO_PLAY.THREE)
    expect(state.setsNeededToWin).toBe(SETS_NEEDED_TO_WIN.TWO)
  })

  it('schema validation rejects payload missing timing object', () => {
    const { timing: _timing, ...partialPayload } = emptyNewSession

    expect(validateMatchSession(partialPayload)).toBe(false)
  })

  it('schema validation rejects payload with invalid status', () => {
    const invalidStatus = {
      ...emptyNewSession,
      status: 'invalid-status'
    }

    expect(validateMatchSession(invalidStatus)).toBe(false)
  })

  it('schema validation rejects finished match without finishedAt timestamp', () => {
    const invalidFinished = {
      ...finishedSessionWithHistory,
      timing: {
        ...finishedSessionWithHistory.timing,
        finishedAt: null
      }
    }

    expect(validateMatchSession(invalidFinished)).toBe(false)
  })

  it('schema validation accepts paused match without finishedAt', () => {
    const pausedSession = {
      ...activeInProgressSession,
      status: MATCH_STATUS.PAUSED
    }

    expect(validateMatchSession(pausedSession)).toBe(true)
    expect(pausedSession.timing.finishedAt).toBe(null)
  })
})

describe('Serialization Round-Trip', () => {
  it('serialize/deserialize round-trip preserves canonical session integrity', () => {
    const sessions = [
      emptyNewSession,
      activeInProgressSession,
      finishedSessionWithHistory,
      specialCharacterTeamNamesSession
    ]

    for (const session of sessions) {
      const serialized = serializeMatchState(session)
      const deserialized = deserializeMatchSession(serialized)

      expect(deserialized).not.toBe(null)
      expect(validateMatchSession(deserialized)).toBe(true)
      expect(deserialized).toEqual(session)
    }
  })

  it('deserializeMatchSession returns null for malformed JSON', () => {
    expect(deserializeMatchSession('{invalid-json')).toBe(null)
    expect(deserializeMatchSession('not-json-at-all')).toBe(null)
    expect(deserializeMatchSession('')).toBe(null)
    expect(deserializeMatchSession(null)).toBe(null)
    expect(deserializeMatchSession(undefined)).toBe(null)
  })
})

describe('Empty Storage Handling', () => {
  it('createDefaultMatchState provides deterministic baseline for empty storage scenario', () => {
    const state = createDefaultMatchState()

    expect(state.setsWon.teamA).toBe(0)
    expect(state.setsWon.teamB).toBe(0)
    expect(state.currentSet.games.teamA).toBe(0)
    expect(state.currentSet.games.teamB).toBe(0)
    expect(state.currentGame.points.teamA).toBe(0)
    expect(state.currentGame.points.teamB).toBe(0)
    expect(state.currentSet.number).toBe(1)
    expect(state.setHistory).toEqual([])
  })
})

describe('Corrupt Payload Handling', () => {
  it('deserializeMatchSession returns null for partial payload missing required fields', () => {
    const {
      scores: _scores,
      currentGame: _currentGame,
      ...partialPayload
    } = emptyNewSession

    expect(deserializeMatchSession(JSON.stringify(partialPayload))).toBe(null)
  })

  it('validateMatchSession rejects payload with negative score values', () => {
    const invalidScores = {
      ...emptyNewSession,
      scores: {
        ...emptyNewSession.scores,
        setsWon: { teamA: -1, teamB: 0 }
      },
      setsWon: { teamA: -1, teamB: 0 }
    }

    expect(validateMatchSession(invalidScores)).toBe(false)
  })

  it('validateMatchSession rejects payload with unsupported set configuration', () => {
    const invalidConfig = {
      ...emptyNewSession,
      setsToPlay: 2,
      setsNeededToWin: 2,
      settings: {
        setsToPlay: 2,
        setsNeededToWin: 2
      }
    }

    expect(validateMatchSession(invalidConfig)).toBe(false)
  })
})

describe('UTF-8 Label Support', () => {
  it('schema validation accepts UTF-8 team labels with accents', () => {
    const utf8Session = {
      ...emptyNewSession,
      teams: {
        teamA: { id: 'teamA', label: 'Niño García' },
        teamB: { id: 'teamB', label: 'São Paulo FC' }
      }
    }

    expect(validateMatchSession(utf8Session)).toBe(true)
    expect(utf8Session.teams.teamA.label).toBe('Niño García')
    expect(utf8Session.teams.teamB.label).toBe('São Paulo FC')
  })

  it('schema validation accepts UTF-8 team labels with emoji', () => {
    const emojiSession = {
      ...emptyNewSession,
      teams: {
        teamA: { id: 'teamA', label: 'Team 🎾' },
        teamB: { id: 'teamB', label: 'Padel 💪' }
      }
    }

    expect(validateMatchSession(emojiSession)).toBe(true)
  })

  it('serialize/deserialize preserves UTF-8 labels including accents and emoji', () => {
    const session = {
      ...emptyNewSession,
      teams: {
        teamA: { id: 'teamA', label: 'Niño 🎾' },
        teamB: { id: 'teamB', label: 'São Paulo 😊' }
      }
    }

    const serialized = serializeMatchState(session)
    const deserialized = deserializeMatchSession(serialized)

    expect(deserialized).not.toBe(null)
    expect(deserialized.teams.teamA.label).toBe('Niño 🎾')
    expect(deserialized.teams.teamB.label).toBe('São Paulo 😊')
  })
})

describe('matchStartTime Initialization and Immutability', () => {
  it('createDefaultMatchState initializes timing.startedAt to match timing.createdAt', () => {
    const state = createDefaultMatchState()

    expect(state.timing.startedAt).not.toBe(null)
    expect(state.timing.startedAt).toBe(state.timing.createdAt)
    expect(typeof state.timing.startedAt).toBe('string')
  })

  it('timing.startedAt is ISO 8601 format for newly created state', () => {
    const state = createDefaultMatchState()
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

    expect(isoPattern.test(state.timing.startedAt)).toBe(true)
    expect(isoPattern.test(state.timing.createdAt)).toBe(true)
    expect(isoPattern.test(state.timing.updatedAt)).toBe(true)
  })

  it('canonical fixture has valid non-null startedAt', () => {
    const originalStartedAt = activeInProgressSession.timing.startedAt

    expect(originalStartedAt).not.toBe(null)
    expect(typeof originalStartedAt).toBe('string')
    expect(validateMatchSession(activeInProgressSession)).toBe(true)
  })

  it('finished session has valid finishedAt timestamp matching completion', () => {
    expect(finishedSessionWithHistory.timing.finishedAt).not.toBe(null)
    expect(typeof finishedSessionWithHistory.timing.finishedAt).toBe('string')
    expect(validateMatchSession(finishedSessionWithHistory)).toBe(true)
  })

  it('timing fields are independent objects across sessions', () => {
    const state1 = createDefaultMatchState()
    const state2 = createDefaultMatchState()

    state1.timing.startedAt = '2024-01-01T00:00:00.000Z'
    state1.timing.finishedAt = '2024-01-01T01:00:00.000Z'

    expect(state2.timing.startedAt).not.toBe('2024-01-01T00:00:00.000Z')
    expect(state2.timing.finishedAt).toBe(null)
  })
})
