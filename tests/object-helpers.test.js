import assert from 'node:assert'
import test from 'node:test'
import {
  scoresEqual,
  sessionsEqual,
  shallowClone,
  shallowEqual,
  stateKeysEqual
} from '../utils/object-helpers.js'

test('shallowClone should clone primitive values', () => {
  assert.equal(shallowClone(42), 42)
  assert.equal(shallowClone('test'), 'test')
  assert.equal(shallowClone(true), true)
})

test('shallowClone should clone null and undefined', () => {
  assert.equal(shallowClone(null), null)
  assert.equal(shallowClone(undefined), undefined)
})

test('shallowClone should shallow clone object', () => {
  const original = { a: 1, b: 2 }
  const cloned = shallowClone(original)

  assert.deepEqual(cloned, original)
  assert.notEqual(cloned, original)
})

test('shallowClone should shallow clone array', () => {
  const original = [1, 2, 3]
  const cloned = shallowClone(original)

  assert.deepEqual(cloned, original)
  assert.notEqual(cloned, original)
})

test('shallowClone should NOT deep clone nested objects', () => {
  const original = { a: { b: 1 } }
  const cloned = shallowClone(original)

  assert.equal(cloned.a, original.a) // Same reference!
})

test('shallowEqual should return true for identical references', () => {
  const obj = { a: 1 }
  assert.equal(shallowEqual(obj, obj), true)
})

test('shallowEqual should return true for equal objects', () => {
  assert.equal(shallowEqual({ a: 1 }, { a: 1 }), true)
})

test('shallowEqual should return false for different objects', () => {
  assert.equal(shallowEqual({ a: 1 }, { a: 2 }), false)
})

test('shallowEqual should return false for different key counts', () => {
  assert.equal(shallowEqual({ a: 1 }, { a: 1, b: 2 }), false)
})

test('shallowEqual should handle null/undefined', () => {
  assert.equal(shallowEqual(null, null), true)
  assert.equal(shallowEqual(null, {}), false)
  assert.equal(shallowEqual(undefined, undefined), true)
})

test('shallowEqual should return false for different key sets', () => {
  assert.equal(shallowEqual({ a: 1 }, { b: 1 }), false)
})

test('shallowEqual should return true for empty objects', () => {
  assert.equal(shallowEqual({}, {}), true)
})

test('stateKeysEqual should compare only specified keys', () => {
  const left = { a: 1, b: 2, c: 3 }
  const right = { a: 1, b: 99, c: 3 }

  assert.equal(stateKeysEqual(left, right, ['a', 'c']), true)
  assert.equal(stateKeysEqual(left, right, ['a', 'b']), false)
})

test('stateKeysEqual should handle missing keys', () => {
  const left = { a: 1 }
  const right = { a: 1, b: 2 }

  assert.equal(stateKeysEqual(left, right, ['a']), true)
})

test('stateKeysEqual should handle identical references', () => {
  const obj = { a: 1 }
  assert.equal(stateKeysEqual(obj, obj, ['a']), true)
})

test('stateKeysEqual should handle null values', () => {
  assert.equal(stateKeysEqual(null, null, ['a']), true)
  assert.equal(stateKeysEqual(null, { a: 1 }, ['a']), false)
})

test('stateKeysEqual should handle undefined values', () => {
  assert.equal(stateKeysEqual(undefined, undefined, ['a']), true)
  assert.equal(stateKeysEqual(undefined, { a: 1 }, ['a']), false)
})

test('scoresEqual should compare match state keys', () => {
  const teamA = { points: 15 }
  const teamB = { points: 0 }
  const setsWon = { teamA: 1, teamB: 0 }

  const state1 = {
    status: 'active',
    setsToPlay: 3,
    setsWon,
    teamA,
    teamB
  }

  const state2 = {
    status: 'active',
    setsToPlay: 3,
    setsWon,
    teamA,
    teamB,
    // Extra keys should be ignored
    extra: 'ignored'
  }

  assert.equal(scoresEqual(state1, state2), true)
})

test('scoresEqual should compare shared extra keys deeply', () => {
  const state1 = {
    status: 'active',
    timing: {
      startedAt: '2024-01-01T00:00:00.000Z'
    }
  }

  const state2 = {
    status: 'active',
    timing: {
      startedAt: '2024-01-02T00:00:00.000Z'
    }
  }

  assert.equal(scoresEqual(state1, state2), false)
})

test('scoresEqual should handle null and undefined inputs', () => {
  assert.equal(scoresEqual(null, null), true)
  assert.equal(scoresEqual(undefined, undefined), true)
  assert.equal(scoresEqual(null, undefined), false)
  assert.equal(scoresEqual(null, { status: 'active' }), false)
  assert.equal(scoresEqual(undefined, { status: 'active' }), false)
})

test('scoresEqual should support null-prototype nested objects', () => {
  const leftSetsWon = Object.create(null)
  leftSetsWon.teamA = 1
  leftSetsWon.teamB = 0

  const rightSetsWon = Object.create(null)
  rightSetsWon.teamA = 1
  rightSetsWon.teamB = 0

  assert.equal(
    scoresEqual({ setsWon: leftSetsWon }, { setsWon: rightSetsWon }),
    true
  )
})

test('scoresEqual should return false for different state', () => {
  const state1 = {
    status: 'active',
    setsToPlay: 3,
    setsWon: { teamA: 1, teamB: 0 },
    teamA: { points: 15 }
  }

  const state2 = {
    status: 'active',
    setsToPlay: 3,
    setsWon: { teamA: 2, teamB: 0 }, // Different setsWon
    teamA: { points: 15 }
  }

  assert.equal(scoresEqual(state1, state2), false)
})

test('scoresEqual should handle identical references', () => {
  const state = { status: 'active' }
  assert.equal(scoresEqual(state, state), true)
})

test('scoresEqual should compare nested objects with different references', () => {
  // This is important because addPoint() returns fresh state objects
  // with new references for nested properties
  const state1 = { setsWon: { teamA: 1, teamB: 0 } }
  const state2 = { setsWon: { teamA: 1, teamB: 0 } } // Different reference, same values
  assert.equal(scoresEqual(state1, state2), true)
})

test('scoresEqual should detect nested object differences', () => {
  const state1 = { setsWon: { teamA: 1, teamB: 0 } }
  const state2 = { setsWon: { teamA: 2, teamB: 0 } }
  assert.equal(scoresEqual(state1, state2), false)
})

test('scoresEqual should handle deeply nested objects with different references', () => {
  const state1 = {
    currentSet: { number: 1, games: { teamA: 3, teamB: 2 } }
  }
  const state2 = {
    currentSet: { number: 1, games: { teamA: 3, teamB: 2 } }
  }
  assert.equal(scoresEqual(state1, state2), true)
})

test('sessionsEqual should compare session keys', () => {
  const timing = { createdAt: '2024-01-01' }

  const session1 = {
    status: 'active',
    updatedAt: 12345,
    timing
  }

  const session2 = {
    status: 'active',
    updatedAt: 12345,
    timing,
    // Extra keys should be ignored
    extra: 'ignored'
  }

  assert.equal(sessionsEqual(session1, session2), true)
})

test('sessionsEqual should return false for different session', () => {
  const session1 = {
    status: 'active',
    updatedAt: 12345,
    timing: { createdAt: '2024-01-01' }
  }

  const session2 = {
    status: 'completed', // Different status
    updatedAt: 12345,
    timing: { createdAt: '2024-01-01' }
  }

  assert.equal(sessionsEqual(session1, session2), false)
})

test('sessionsEqual should handle identical references', () => {
  const session = { status: 'active' }
  assert.equal(sessionsEqual(session, session), true)
})

test('sessionsEqual should compare nested objects with different references', () => {
  const session1 = {
    timing: { createdAt: '2024-01-01' }
  }
  const session2 = {
    timing: { createdAt: '2024-01-01' } // Different reference, same values
  }
  assert.equal(sessionsEqual(session1, session2), true)
})

test('sessionsEqual should detect nested object differences', () => {
  const session1 = {
    timing: { createdAt: '2024-01-01' }
  }
  const session2 = {
    timing: { createdAt: '2024-01-02' }
  }
  assert.equal(sessionsEqual(session1, session2), false)
})
