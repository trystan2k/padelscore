import { describe, expect, it } from 'vitest'
import {
  MATCH_SET_OPTIONS,
  PERSISTED_ADVANTAGE_POINT_VALUE,
  PERSISTED_GAME_POINT_VALUE,
  TIE_BREAK_ENTRY_GAMES
} from '../../utils/constants.js'
import { SCORE_POINTS } from '../../utils/scoring-constants.js'
import {
  cloneMatchState,
  cloneMatchStateOrNull,
  cloneSetHistory,
  cloneSetHistoryWithFirstSetFallback,
  formatDate,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecord,
  isSupportedSetConfiguration,
  isSupportedSetsToPlay,
  isTeamIdentifier,
  isTieBreakMode,
  isTieBreakModeForState,
  normalizeSetHistory,
  normalizeSetHistoryWithOptions,
  resolveSetsToPlayFromSetsNeededToWin,
  resolveWinnerTeam,
  resolveWinnerTeamWithFallback,
  toNonNegativeInteger,
  toNonNegativeIntegerWithRequiredFallback,
  toPersistedPointValue,
  toPositiveInteger,
  toPositiveIntegerWithRequiredFallback,
  toRuntimePointValue,
  toSupportedSetsToPlay
} from '../../utils/validation.js'

describe('isRecord', () => {
  it('returns true for plain objects', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ foo: 'bar' })).toBe(true)
  })

  it('returns true for arrays (arrays are objects)', () => {
    expect(isRecord([])).toBe(true)
    expect(isRecord([1, 2, 3])).toBe(true)
  })

  it('returns false for null', () => {
    expect(isRecord(null)).toBe(false)
  })

  it('returns false for primitives', () => {
    expect(isRecord(undefined)).toBe(false)
    expect(isRecord('string')).toBe(false)
    expect(isRecord(123)).toBe(false)
    expect(isRecord(true)).toBe(false)
  })
})

describe('isNonNegativeInteger', () => {
  it('returns true for zero', () => {
    expect(isNonNegativeInteger(0)).toBe(true)
  })

  it('returns true for positive integers', () => {
    expect(isNonNegativeInteger(1)).toBe(true)
    expect(isNonNegativeInteger(100)).toBe(true)
  })

  it('returns false for negative integers', () => {
    expect(isNonNegativeInteger(-1)).toBe(false)
    expect(isNonNegativeInteger(-100)).toBe(false)
  })

  it('returns false for non-integers', () => {
    expect(isNonNegativeInteger(1.5)).toBe(false)
    expect(isNonNegativeInteger('1')).toBe(false)
    expect(isNonNegativeInteger(null)).toBe(false)
    expect(isNonNegativeInteger(undefined)).toBe(false)
  })
})

describe('isPositiveInteger', () => {
  it('returns true for positive integers', () => {
    expect(isPositiveInteger(1)).toBe(true)
    expect(isPositiveInteger(100)).toBe(true)
  })

  it('returns false for zero', () => {
    expect(isPositiveInteger(0)).toBe(false)
  })

  it('returns false for negative integers', () => {
    expect(isPositiveInteger(-1)).toBe(false)
    expect(isPositiveInteger(-100)).toBe(false)
  })

  it('returns false for non-integers', () => {
    expect(isPositiveInteger(1.5)).toBe(false)
    expect(isPositiveInteger('1')).toBe(false)
    expect(isPositiveInteger(null)).toBe(false)
    expect(isPositiveInteger(undefined)).toBe(false)
  })
})

describe('toNonNegativeInteger', () => {
  it('returns value for non-negative integers', () => {
    expect(toNonNegativeInteger(0)).toBe(0)
    expect(toNonNegativeInteger(5)).toBe(5)
  })

  it('returns default fallback (0) for invalid values', () => {
    expect(toNonNegativeInteger(-1)).toBe(0)
    expect(toNonNegativeInteger(1.5)).toBe(0)
    expect(toNonNegativeInteger('1')).toBe(0)
    expect(toNonNegativeInteger(null)).toBe(0)
    expect(toNonNegativeInteger(undefined)).toBe(0)
  })

  it('returns custom fallback for invalid values', () => {
    expect(toNonNegativeInteger(-1, 10)).toBe(10)
    expect(toNonNegativeInteger('1', 99)).toBe(99)
  })
})

describe('toPositiveInteger', () => {
  it('returns value for positive integers', () => {
    expect(toPositiveInteger(1)).toBe(1)
    expect(toPositiveInteger(100)).toBe(100)
  })

  it('returns default fallback (1) for invalid values', () => {
    expect(toPositiveInteger(0)).toBe(1)
    expect(toPositiveInteger(-1)).toBe(1)
    expect(toPositiveInteger(1.5)).toBe(1)
    expect(toPositiveInteger('1')).toBe(1)
    expect(toPositiveInteger(null)).toBe(1)
    expect(toPositiveInteger(undefined)).toBe(1)
  })

  it('returns custom fallback for invalid values', () => {
    expect(toPositiveInteger(0, 5)).toBe(5)
    expect(toPositiveInteger(-1, 10)).toBe(10)
  })
})

describe('toNonNegativeIntegerWithRequiredFallback', () => {
  it('returns value for non-negative integers', () => {
    expect(toNonNegativeIntegerWithRequiredFallback(5, 99)).toBe(5)
  })

  it('returns required fallback for invalid values', () => {
    expect(toNonNegativeIntegerWithRequiredFallback(-1, 10)).toBe(10)
    expect(toNonNegativeIntegerWithRequiredFallback('1', 20)).toBe(20)
  })
})

describe('toPositiveIntegerWithRequiredFallback', () => {
  it('returns value for positive integers', () => {
    expect(toPositiveIntegerWithRequiredFallback(5, 99)).toBe(5)
  })

  it('returns required fallback for invalid values', () => {
    expect(toPositiveIntegerWithRequiredFallback(0, 10)).toBe(10)
    expect(toPositiveIntegerWithRequiredFallback(-1, 20)).toBe(20)
  })
})

describe('isTeamIdentifier', () => {
  it('returns true for teamA', () => {
    expect(isTeamIdentifier('teamA')).toBe(true)
  })

  it('returns true for teamB', () => {
    expect(isTeamIdentifier('teamB')).toBe(true)
  })

  it('returns false for other strings', () => {
    expect(isTeamIdentifier('teamC')).toBe(false)
    expect(isTeamIdentifier('TeamA')).toBe(false)
    expect(isTeamIdentifier('')).toBe(false)
  })

  it('returns false for non-strings', () => {
    expect(isTeamIdentifier(1)).toBe(false)
    expect(isTeamIdentifier(null)).toBe(false)
    expect(isTeamIdentifier(undefined)).toBe(false)
  })
})

describe('isSupportedSetsToPlay', () => {
  it('returns true for valid set options', () => {
    MATCH_SET_OPTIONS.forEach((option) => {
      expect(isSupportedSetsToPlay(option)).toBe(true)
    })
  })

  it('returns false for invalid values', () => {
    expect(isSupportedSetsToPlay(2)).toBe(false)
    expect(isSupportedSetsToPlay(4)).toBe(false)
    expect(isSupportedSetsToPlay('3')).toBe(false)
    expect(isSupportedSetsToPlay(null)).toBe(false)
  })
})

describe('isTieBreakMode', () => {
  it('returns true when both games equal TIE_BREAK_ENTRY_GAMES', () => {
    expect(isTieBreakMode(TIE_BREAK_ENTRY_GAMES, TIE_BREAK_ENTRY_GAMES)).toBe(
      true
    )
  })

  it('returns false when games are not both TIE_BREAK_ENTRY_GAMES', () => {
    expect(isTieBreakMode(6, 5)).toBe(false)
    expect(isTieBreakMode(5, 6)).toBe(false)
    expect(isTieBreakMode(7, 6)).toBe(false)
    expect(isTieBreakMode(6, 7)).toBe(false)
  })
})

describe('isTieBreakModeForState', () => {
  it('returns true when state has tie break game scores', () => {
    const state = {
      currentSetStatus: {
        teamAGames: TIE_BREAK_ENTRY_GAMES,
        teamBGames: TIE_BREAK_ENTRY_GAMES
      }
    }
    expect(isTieBreakModeForState(state)).toBe(true)
  })

  it('returns false when state does not have tie break scores', () => {
    const state = {
      currentSetStatus: {
        teamAGames: 5,
        teamBGames: 4
      }
    }
    expect(isTieBreakModeForState(state)).toBe(false)
  })
})

describe('resolveWinnerTeam', () => {
  it('returns winnerTeam if valid team identifier', () => {
    expect(resolveWinnerTeam({ winnerTeam: 'teamA' })).toBe('teamA')
    expect(resolveWinnerTeam({ winnerTeam: 'teamB' })).toBe('teamB')
  })

  it('returns winner.team if winnerTeam not present', () => {
    expect(resolveWinnerTeam({ winner: { team: 'teamA' } })).toBe('teamA')
    expect(resolveWinnerTeam({ winner: { team: 'teamB' } })).toBe('teamB')
  })

  it('prefers winnerTeam over winner.team', () => {
    expect(
      resolveWinnerTeam({ winnerTeam: 'teamA', winner: { team: 'teamB' } })
    ).toBe('teamA')
  })

  it('returns null for invalid match state', () => {
    expect(resolveWinnerTeam(null)).toBe(null)
    expect(resolveWinnerTeam(undefined)).toBe(null)
    expect(resolveWinnerTeam('string')).toBe(null)
    expect(resolveWinnerTeam(123)).toBe(null)
  })

  it('returns null when no valid winner found', () => {
    expect(resolveWinnerTeam({})).toBe(null)
    expect(resolveWinnerTeam({ winnerTeam: 'teamC' })).toBe(null)
    expect(resolveWinnerTeam({ winner: { team: 'teamC' } })).toBe(null)
  })
})

describe('resolveWinnerTeamWithFallback', () => {
  it('returns primary winner when available', () => {
    expect(
      resolveWinnerTeamWithFallback(
        { winnerTeam: 'teamA' },
        { winnerTeam: 'teamB' }
      )
    ).toBe('teamA')
  })

  it('returns fallback winner when primary not available', () => {
    expect(resolveWinnerTeamWithFallback({}, { winnerTeam: 'teamB' })).toBe(
      'teamB'
    )
    expect(resolveWinnerTeamWithFallback(null, { winnerTeam: 'teamA' })).toBe(
      'teamA'
    )
  })

  it('returns null when neither has valid winner', () => {
    expect(resolveWinnerTeamWithFallback({}, {})).toBe(null)
    expect(resolveWinnerTeamWithFallback(null, null)).toBe(null)
  })
})

describe('cloneMatchState', () => {
  it('creates a deep copy of match state', () => {
    const state = { score: { teamA: 15, teamB: 30 } }
    const cloned = cloneMatchState(state)
    expect(cloned).toEqual(state)
    expect(cloned).not.toBe(state)
    expect(cloned.score).not.toBe(state.score)
  })

  it('handles arrays', () => {
    const state = { sets: [1, 2, 3] }
    const cloned = cloneMatchState(state)
    expect(cloned).toEqual(state)
    expect(cloned.sets).not.toBe(state.sets)
  })

  it('returns original value on JSON error', () => {
    const circular = { a: 1 }
    circular.self = circular
    const cloned = cloneMatchState(circular)
    expect(cloned).toBe(circular)
  })
})

describe('cloneMatchStateOrNull', () => {
  it('creates a deep copy of match state', () => {
    const state = { score: { teamA: 15 } }
    const cloned = cloneMatchStateOrNull(state)
    expect(cloned).toEqual(state)
    expect(cloned).not.toBe(state)
  })

  it('returns null on JSON error', () => {
    const circular = { a: 1 }
    circular.self = circular
    const cloned = cloneMatchStateOrNull(circular)
    expect(cloned).toBe(null)
  })
})

describe('toPersistedPointValue', () => {
  it('returns integer value as-is when non-negative', () => {
    expect(toPersistedPointValue(0)).toBe(0)
    expect(toPersistedPointValue(15)).toBe(15)
    expect(toPersistedPointValue(30)).toBe(30)
    expect(toPersistedPointValue(40)).toBe(40)
  })

  it('returns PERSISTED_ADVANTAGE_POINT_VALUE for ADVANTAGE', () => {
    expect(toPersistedPointValue(SCORE_POINTS.ADVANTAGE)).toBe(
      PERSISTED_ADVANTAGE_POINT_VALUE
    )
  })

  it('returns PERSISTED_GAME_POINT_VALUE for GAME', () => {
    expect(toPersistedPointValue(SCORE_POINTS.GAME)).toBe(
      PERSISTED_GAME_POINT_VALUE
    )
  })

  it('returns LOVE for invalid values', () => {
    expect(toPersistedPointValue(-1)).toBe(SCORE_POINTS.LOVE)
    expect(toPersistedPointValue('invalid')).toBe(SCORE_POINTS.LOVE)
    expect(toPersistedPointValue(null)).toBe(SCORE_POINTS.LOVE)
    expect(toPersistedPointValue(undefined)).toBe(SCORE_POINTS.LOVE)
  })
})

describe('toRuntimePointValue', () => {
  it('returns value as-is in tie break mode', () => {
    expect(toRuntimePointValue(5, true)).toBe(5)
    expect(toRuntimePointValue(10, true)).toBe(10)
    expect(toRuntimePointValue(PERSISTED_ADVANTAGE_POINT_VALUE, true)).toBe(
      PERSISTED_ADVANTAGE_POINT_VALUE
    )
  })

  it('converts PERSISTED_ADVANTAGE_POINT_VALUE to ADVANTAGE in non-tie break', () => {
    expect(toRuntimePointValue(PERSISTED_ADVANTAGE_POINT_VALUE, false)).toBe(
      SCORE_POINTS.ADVANTAGE
    )
  })

  it('converts PERSISTED_GAME_POINT_VALUE to GAME in non-tie break', () => {
    expect(toRuntimePointValue(PERSISTED_GAME_POINT_VALUE, false)).toBe(
      SCORE_POINTS.GAME
    )
  })

  it('returns regular point values as-is in non-tie break', () => {
    expect(toRuntimePointValue(0, false)).toBe(0)
    expect(toRuntimePointValue(15, false)).toBe(15)
    expect(toRuntimePointValue(30, false)).toBe(30)
    expect(toRuntimePointValue(40, false)).toBe(40)
  })

  it('returns fallback for invalid values', () => {
    expect(toRuntimePointValue(-1, false)).toBe(SCORE_POINTS.LOVE)
    expect(toRuntimePointValue('invalid', false)).toBe(SCORE_POINTS.LOVE)
    expect(toRuntimePointValue(1.5, false)).toBe(SCORE_POINTS.LOVE)
  })

  it('returns custom fallback for invalid values', () => {
    expect(toRuntimePointValue(-1, false, 15)).toBe(15)
    expect(toRuntimePointValue('invalid', true, 5)).toBe(5)
  })
})

describe('toSupportedSetsToPlay', () => {
  it('returns value if supported', () => {
    expect(toSupportedSetsToPlay(1)).toBe(1)
    expect(toSupportedSetsToPlay(3)).toBe(3)
    expect(toSupportedSetsToPlay(5)).toBe(5)
  })

  it('returns default fallback for unsupported values', () => {
    expect(toSupportedSetsToPlay(2)).toBe(3)
    expect(toSupportedSetsToPlay(4)).toBe(3)
    expect(toSupportedSetsToPlay(null)).toBe(3)
  })

  it('returns custom fallback for unsupported values', () => {
    expect(toSupportedSetsToPlay(2, 1)).toBe(1)
    expect(toSupportedSetsToPlay(null, 5)).toBe(5)
  })
})

describe('resolveSetsToPlayFromSetsNeededToWin', () => {
  it('returns 1 for setsNeededToWin <= 1', () => {
    expect(resolveSetsToPlayFromSetsNeededToWin(0)).toBe(1)
    expect(resolveSetsToPlayFromSetsNeededToWin(1)).toBe(1)
  })

  it('returns 3 for setsNeededToWin = 2', () => {
    expect(resolveSetsToPlayFromSetsNeededToWin(2)).toBe(3)
  })

  it('returns 5 for setsNeededToWin >= 3', () => {
    expect(resolveSetsToPlayFromSetsNeededToWin(3)).toBe(5)
    expect(resolveSetsToPlayFromSetsNeededToWin(4)).toBe(5)
    expect(resolveSetsToPlayFromSetsNeededToWin(100)).toBe(5)
  })
})

describe('isSupportedSetConfiguration', () => {
  it('returns true for valid configurations', () => {
    expect(isSupportedSetConfiguration(1, 1)).toBe(true)
    expect(isSupportedSetConfiguration(3, 2)).toBe(true)
    expect(isSupportedSetConfiguration(5, 3)).toBe(true)
  })

  it('returns false for invalid configurations', () => {
    expect(isSupportedSetConfiguration(1, 2)).toBe(false)
    expect(isSupportedSetConfiguration(3, 1)).toBe(false)
    expect(isSupportedSetConfiguration(3, 3)).toBe(false)
    expect(isSupportedSetConfiguration(5, 2)).toBe(false)
  })
})

describe('normalizeSetHistoryWithOptions', () => {
  it('returns empty array for non-array input', () => {
    expect(normalizeSetHistoryWithOptions(null)).toEqual([])
    expect(normalizeSetHistoryWithOptions(undefined)).toEqual([])
    expect(normalizeSetHistoryWithOptions({})).toEqual([])
    expect(normalizeSetHistoryWithOptions('string')).toEqual([])
  })

  it('normalizes set history entries with index fallback (default)', () => {
    const history = [
      { setNumber: 1, teamAGames: 6, teamBGames: 4 },
      { setNumber: 2, teamAGames: 4, teamBGames: 6 }
    ]
    const result = normalizeSetHistoryWithOptions(history)
    expect(result).toEqual([
      { setNumber: 1, teamAGames: 6, teamBGames: 4 },
      { setNumber: 2, teamAGames: 4, teamBGames: 6 }
    ])
  })

  it('uses index fallback when setNumber is invalid', () => {
    const history = [
      { setNumber: null, teamAGames: 6, teamBGames: 4 },
      { teamAGames: 4, teamBGames: 6 }
    ]
    const result = normalizeSetHistoryWithOptions(history)
    expect(result).toEqual([
      { setNumber: 1, teamAGames: 6, teamBGames: 4 },
      { setNumber: 2, teamAGames: 4, teamBGames: 6 }
    ])
  })

  it('uses firstSet fallback when specified', () => {
    const history = [
      { setNumber: null, teamAGames: 6, teamBGames: 4 },
      { teamAGames: 4, teamBGames: 6 }
    ]
    const result = normalizeSetHistoryWithOptions(history, {
      setNumberFallback: 'firstSet'
    })
    expect(result).toEqual([
      { setNumber: 1, teamAGames: 6, teamBGames: 4 },
      { setNumber: 1, teamAGames: 4, teamBGames: 6 }
    ])
  })

  it('sorts by setNumber when sortBySetNumber is true', () => {
    const history = [
      { setNumber: 2, teamAGames: 4, teamBGames: 6 },
      { setNumber: 1, teamAGames: 6, teamBGames: 4 }
    ]
    const result = normalizeSetHistoryWithOptions(history, {
      sortBySetNumber: true
    })
    expect(result).toEqual([
      { setNumber: 1, teamAGames: 6, teamBGames: 4 },
      { setNumber: 2, teamAGames: 4, teamBGames: 6 }
    ])
  })

  it('normalizes games with defaults', () => {
    const history = [{ setNumber: 1 }]
    const result = normalizeSetHistoryWithOptions(history)
    expect(result).toEqual([{ setNumber: 1, teamAGames: 0, teamBGames: 0 }])
  })
})

describe('cloneSetHistory', () => {
  it('creates normalized copy with index fallback', () => {
    const history = [{ setNumber: 1, teamAGames: 6, teamBGames: 4 }]
    const result = cloneSetHistory(history)
    expect(result).toEqual(history)
    expect(result).not.toBe(history)
  })
})

describe('cloneSetHistoryWithFirstSetFallback', () => {
  it('creates normalized copy with firstSet fallback', () => {
    const history = [
      { setNumber: null, teamAGames: 6, teamBGames: 4 },
      { teamAGames: 4, teamBGames: 6 }
    ]
    const result = cloneSetHistoryWithFirstSetFallback(history)
    expect(result).toEqual([
      { setNumber: 1, teamAGames: 6, teamBGames: 4 },
      { setNumber: 1, teamAGames: 4, teamBGames: 6 }
    ])
  })
})

describe('normalizeSetHistory', () => {
  it('normalizes and sorts by setNumber', () => {
    const history = [
      { setNumber: 2, teamAGames: 4, teamBGames: 6 },
      { setNumber: 1, teamAGames: 6, teamBGames: 4 }
    ]
    const result = normalizeSetHistory(history)
    expect(result).toEqual([
      { setNumber: 1, teamAGames: 6, teamBGames: 4 },
      { setNumber: 2, teamAGames: 4, teamBGames: 6 }
    ])
  })
})

describe('formatDate', () => {
  it('formats date from localTime object', () => {
    const entry = {
      localTime: {
        day: 15,
        month: 3,
        year: 2024,
        hour: 14,
        minute: 30
      }
    }
    expect(formatDate(entry)).toBe('15/03/2024 14:30')
  })

  it('pads single digit values', () => {
    const entry = {
      localTime: {
        day: 5,
        month: 1,
        year: 2024,
        hour: 9,
        minute: 5
      }
    }
    expect(formatDate(entry)).toBe('05/01/2024 09:05')
  })

  it('formats date from completedAt timestamp', () => {
    const entry = {
      completedAt: 1710514200000
    }
    const result = formatDate(entry)
    expect(typeof result).toBe('string')
    expect(result.length).toBe(16)
  })

  it('returns empty string for null/undefined entry', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })

  it('returns empty string for entry without valid date info', () => {
    expect(formatDate({})).toBe('')
    expect(formatDate({ localTime: {} })).toBe('')
    expect(formatDate({ localTime: { day: 15 } })).toBe('')
  })
})
