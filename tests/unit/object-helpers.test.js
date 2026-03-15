import { describe, expect, it } from 'vitest'
import {
  scoresEqual,
  sessionsEqual,
  shallowClone,
  shallowEqual,
  stateKeysEqual
} from '../../utils/object-helpers.js'

describe('shallowClone', () => {
  it('returns null as-is', () => {
    expect(shallowClone(null)).toBe(null)
  })

  it('returns undefined as-is', () => {
    expect(shallowClone(undefined)).toBe(undefined)
  })

  it('returns primitives as-is', () => {
    expect(shallowClone(42)).toBe(42)
    expect(shallowClone('string')).toBe('string')
    expect(shallowClone(true)).toBe(true)
  })

  it('clones arrays', () => {
    const arr = [1, 2, 3]
    const cloned = shallowClone(arr)
    expect(cloned).toEqual(arr)
    expect(cloned).not.toBe(arr)
    cloned[0] = 99
    expect(arr[0]).toBe(1)
  })

  it('clones objects', () => {
    const obj = { a: 1, b: 2 }
    const cloned = shallowClone(obj)
    expect(cloned).toEqual(obj)
    expect(cloned).not.toBe(obj)
    cloned.a = 99
    expect(obj.a).toBe(1)
  })

  it('does not deep clone nested objects', () => {
    const obj = { nested: { value: 1 } }
    const cloned = shallowClone(obj)
    expect(cloned.nested).toBe(obj.nested)
  })
})

describe('shallowEqual', () => {
  it('returns true for identical references', () => {
    const obj = { a: 1 }
    expect(shallowEqual(obj, obj)).toBe(true)
  })

  it('returns true for equal objects', () => {
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
  })

  it('returns true for null === null', () => {
    expect(shallowEqual(null, null)).toBe(true)
  })

  it('returns true for undefined === undefined', () => {
    expect(shallowEqual(undefined, undefined)).toBe(true)
  })

  it('returns false for null vs undefined', () => {
    expect(shallowEqual(null, undefined)).toBe(false)
    expect(shallowEqual(undefined, null)).toBe(false)
  })

  it('returns false for null vs object', () => {
    expect(shallowEqual(null, {})).toBe(false)
    expect(shallowEqual({}, null)).toBe(false)
  })

  it('returns false for different key counts', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('returns false for different keys', () => {
    expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false)
  })

  it('returns false for different values', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('compares nested objects by reference', () => {
    const nested = { value: 1 }
    expect(shallowEqual({ nested }, { nested })).toBe(true)
    expect(shallowEqual({ nested }, { nested: { value: 1 } })).toBe(false)
  })

  it('compares arrays by reference', () => {
    const arr = [1, 2, 3]
    expect(shallowEqual({ arr }, { arr })).toBe(true)
    expect(shallowEqual({ arr }, { arr: [1, 2, 3] })).toBe(false)
  })
})

describe('stateKeysEqual', () => {
  it('returns true for identical references', () => {
    const state = { a: 1, b: 2 }
    expect(stateKeysEqual(state, state, ['a', 'b'])).toBe(true)
  })

  it('returns true for equal values on specified keys', () => {
    expect(stateKeysEqual({ a: 1, b: 2 }, { a: 1, b: 2 }, ['a', 'b'])).toBe(
      true
    )
  })

  it('ignores keys not in the comparison list', () => {
    expect(stateKeysEqual({ a: 1, c: 3 }, { a: 1, c: 99 }, ['a'])).toBe(true)
  })

  it('returns true for null === null', () => {
    expect(stateKeysEqual(null, null, ['a'])).toBe(true)
  })

  it('returns true for undefined === undefined', () => {
    expect(stateKeysEqual(undefined, undefined, ['a'])).toBe(true)
  })

  it('returns false for null vs object', () => {
    expect(stateKeysEqual(null, { a: 1 }, ['a'])).toBe(false)
    expect(stateKeysEqual({ a: 1 }, null, ['a'])).toBe(false)
  })

  it('returns false for different primitive values', () => {
    expect(stateKeysEqual({ a: 1 }, { a: 2 }, ['a'])).toBe(false)
  })

  it('performs deep comparison for nested objects', () => {
    expect(
      stateKeysEqual({ nested: { value: 1 } }, { nested: { value: 1 } }, [
        'nested'
      ])
    ).toBe(true)
    expect(
      stateKeysEqual({ nested: { value: 1 } }, { nested: { value: 2 } }, [
        'nested'
      ])
    ).toBe(false)
  })

  it('performs deep comparison for arrays', () => {
    expect(stateKeysEqual({ arr: [1, 2] }, { arr: [1, 2] }, ['arr'])).toBe(true)
    expect(stateKeysEqual({ arr: [1, 2] }, { arr: [1, 3] }, ['arr'])).toBe(
      false
    )
  })
})

describe('scoresEqual', () => {
  it('returns true for identical references', () => {
    const state = { status: 'playing', setsWon: { teamA: 0, teamB: 0 } }
    expect(scoresEqual(state, state)).toBe(true)
  })

  it('returns true for equal score states', () => {
    const left = {
      status: 'playing',
      setsToPlay: 3,
      setsNeededToWin: 2,
      setsWon: { teamA: 1, teamB: 0 },
      currentSet: 2,
      currentGame: 1,
      teamA: { points: 15 },
      teamB: { points: 30 },
      currentSetStatus: { teamAGames: 6, teamBGames: 4 },
      setHistory: [{ setNumber: 1, teamAGames: 6, teamBGames: 4 }],
      updatedAt: 1234567890
    }
    const right = { ...left }
    expect(scoresEqual(left, right)).toBe(true)
  })

  it('returns true when extra keys differ in only one state', () => {
    const left = {
      status: 'playing',
      setsWon: { teamA: 0, teamB: 0 },
      extra: 1
    }
    const right = { status: 'playing', setsWon: { teamA: 0, teamB: 0 } }
    expect(scoresEqual(left, right)).toBe(true)
  })

  it('returns false when score keys differ', () => {
    const left = { status: 'playing', setsWon: { teamA: 0, teamB: 0 } }
    const right = { status: 'finished', setsWon: { teamA: 0, teamB: 0 } }
    expect(scoresEqual(left, right)).toBe(false)
  })

  it('returns false when extra keys that exist in both differ', () => {
    const left = {
      status: 'playing',
      setsWon: { teamA: 0, teamB: 0 },
      custom: 1
    }
    const right = {
      status: 'playing',
      setsWon: { teamA: 0, teamB: 0 },
      custom: 2
    }
    expect(scoresEqual(left, right)).toBe(false)
  })

  it('handles null and undefined gracefully', () => {
    expect(scoresEqual(null, null)).toBe(true)
    expect(scoresEqual(undefined, undefined)).toBe(true)
    expect(scoresEqual(null, {})).toBe(false)
    expect(scoresEqual({}, null)).toBe(false)
  })
})

describe('sessionsEqual', () => {
  it('returns true for identical references', () => {
    const session = { status: 'playing', setsWon: { teamA: 0, teamB: 0 } }
    expect(sessionsEqual(session, session)).toBe(true)
  })

  it('returns true for equal sessions', () => {
    const left = {
      status: 'playing',
      setsToPlay: 3,
      setsNeededToWin: 2,
      setsWon: { teamA: 1, teamB: 1 },
      currentSet: 3,
      currentGame: 1,
      setHistory: [],
      schemaVersion: 1,
      updatedAt: 1234567890,
      timing: { startedAt: 1234560000 },
      teams: { teamA: { label: 'A' }, teamB: { label: 'B' } },
      winnerTeam: null,
      winner: null
    }
    const right = { ...left }
    expect(sessionsEqual(left, right)).toBe(true)
  })

  it('returns false when session keys differ', () => {
    const left = { status: 'playing', setsWon: { teamA: 0, teamB: 0 } }
    const right = { status: 'finished', setsWon: { teamA: 2, teamB: 1 } }
    expect(sessionsEqual(left, right)).toBe(false)
  })

  it('handles null and undefined gracefully', () => {
    expect(sessionsEqual(null, null)).toBe(true)
    expect(sessionsEqual(undefined, undefined)).toBe(true)
    expect(sessionsEqual(null, {})).toBe(false)
    expect(sessionsEqual({}, null)).toBe(false)
  })
})
