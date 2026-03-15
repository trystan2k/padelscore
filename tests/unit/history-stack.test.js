import { describe, expect, it } from 'vitest'
import { createHistoryStack, deepCopyState } from '../../utils/history-stack.js'

describe('history-stack', () => {
  describe('createHistoryStack', () => {
    it('creates empty stack', () => {
      const stack = createHistoryStack()
      expect(stack.size()).toBe(0)
      expect(stack.isEmpty()).toBe(true)
    })

    it('pushes state and increments size', () => {
      const stack = createHistoryStack()
      const state = { points: 0, games: 1 }

      stack.push(state)

      expect(stack.size()).toBe(1)
      expect(stack.isEmpty()).toBe(false)
    })

    it('returns deep copy on push', () => {
      const stack = createHistoryStack()
      const state = { points: 0, nested: { value: 1 } }

      const result = stack.push(state)

      result.points = 15
      expect(state.points).toBe(0)
    })

    it('pops last pushed state', () => {
      const stack = createHistoryStack()
      stack.push({ points: 0 })
      stack.push({ points: 15 })

      const popped = stack.pop()

      expect(popped).toEqual({ points: 15 })
      expect(stack.size()).toBe(1)
    })

    it('returns null when popping empty stack', () => {
      const stack = createHistoryStack()

      expect(stack.pop()).toBeNull()
    })

    it('returns deep copy on pop', () => {
      const stack = createHistoryStack()
      stack.push({ points: 0, nested: { value: 1 } })

      const popped = stack.pop()
      popped.nested.value = 999

      expect(stack.size()).toBe(0)
    })

    it('clears all entries', () => {
      const stack = createHistoryStack()
      stack.push({ points: 0 })
      stack.push({ points: 15 })
      stack.push({ points: 30 })

      stack.clear()

      expect(stack.size()).toBe(0)
      expect(stack.isEmpty()).toBe(true)
    })

    it('maintains LIFO order', () => {
      const stack = createHistoryStack()
      stack.push({ id: 1 })
      stack.push({ id: 2 })
      stack.push({ id: 3 })

      expect(stack.pop()).toEqual({ id: 3 })
      expect(stack.pop()).toEqual({ id: 2 })
      expect(stack.pop()).toEqual({ id: 1 })
      expect(stack.pop()).toBeNull()
    })
  })

  describe('deepCopyState', () => {
    it('creates independent copy of object', () => {
      const original = { a: 1, b: { c: 2 } }
      const copy = deepCopyState(original)

      copy.a = 999
      copy.b.c = 999

      expect(original.a).toBe(1)
      expect(original.b.c).toBe(2)
    })

    it('copies arrays', () => {
      const original = { items: [1, 2, 3] }
      const copy = deepCopyState(original)

      copy.items.push(4)

      expect(original.items).toEqual([1, 2, 3])
    })

    it('throws for null input', () => {
      expect(() => deepCopyState(null)).toThrow(TypeError)
    })

    it('throws for undefined input', () => {
      expect(() => deepCopyState(undefined)).toThrow(TypeError)
    })

    it('throws for primitive input', () => {
      expect(() => deepCopyState(42)).toThrow(TypeError)
      expect(() => deepCopyState('string')).toThrow(TypeError)
    })

    it('throws for circular references', () => {
      const circular = { a: 1 }
      circular.self = circular

      expect(() => deepCopyState(circular)).toThrow(TypeError)
    })

    it('throws for functions in state', () => {
      const withFn = { a: 1, fn: () => {} }

      expect(() => deepCopyState(withFn)).toThrow(TypeError)
    })

    it('throws for undefined values in state', () => {
      const withUndefined = { a: 1, b: undefined }

      expect(() => deepCopyState(withUndefined)).toThrow(TypeError)
    })

    it('throws for non-finite numbers', () => {
      expect(() => deepCopyState({ value: Infinity })).toThrow(TypeError)
      expect(() => deepCopyState({ value: NaN })).toThrow(TypeError)
    })

    it('accepts null as property value', () => {
      const withNull = { a: 1, b: null }
      const copy = deepCopyState(withNull)

      expect(copy).toEqual({ a: 1, b: null })
    })

    it('accepts boolean values', () => {
      const withBool = { active: true, disabled: false }
      const copy = deepCopyState(withBool)

      expect(copy).toEqual({ active: true, disabled: false })
    })

    it('accepts string values', () => {
      const withStrings = { name: 'test', label: 'Team A' }
      const copy = deepCopyState(withStrings)

      expect(copy).toEqual({ name: 'test', label: 'Team A' })
    })
  })
})
