import { createHistoryStack } from '../utils/history-stack.js'
import { cloneMatchState } from '../utils/validation.js'

export function createTestHistoryStack() {
  return createHistoryStack()
}

export function cloneTestState(state) {
  return cloneMatchState(state)
}
