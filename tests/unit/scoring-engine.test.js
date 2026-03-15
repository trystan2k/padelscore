import { describe, expect, it } from 'vitest'
import { createHistoryStack } from '../../utils/history-stack.js'
import { createInitialMatchState } from '../../utils/match-state.js'
import { SCORE_POINTS } from '../../utils/scoring-constants.js'
import { addPoint, removePoint } from '../../utils/scoring-engine.js'

function createScoreState(teamAPoints, teamBPoints) {
  const state = createInitialMatchState()
  state.teamA.points = teamAPoints
  state.teamB.points = teamBPoints
  return state
}

function createGameState(teamAGames, teamBGames) {
  const state = createInitialMatchState()
  state.teamA.games = teamAGames
  state.teamB.games = teamBGames
  state.currentSetStatus.teamAGames = teamAGames
  state.currentSetStatus.teamBGames = teamBGames
  return state
}

function createTieBreakState(teamAPoints = 0, teamBPoints = 0) {
  const state = createInitialMatchState()
  state.teamA.points = teamAPoints
  state.teamB.points = teamBPoints
  state.teamA.games = 6
  state.teamB.games = 6
  state.currentSetStatus.teamAGames = 6
  state.currentSetStatus.teamBGames = 6
  return state
}

describe('scoring-engine', () => {
  describe('addPoint - basic scoring', () => {
    it('advances LOVE -> FIFTEEN', () => {
      const state = createInitialMatchState()
      const result = addPoint(state, 'teamA')

      expect(result.teamA.points).toBe(SCORE_POINTS.FIFTEEN)
      expect(result.teamB.points).toBe(SCORE_POINTS.LOVE)
    })

    it('advances FIFTEEN -> THIRTY', () => {
      const state = createScoreState(SCORE_POINTS.FIFTEEN, SCORE_POINTS.LOVE)
      const result = addPoint(state, 'teamA')

      expect(result.teamA.points).toBe(SCORE_POINTS.THIRTY)
    })

    it('advances THIRTY -> FORTY', () => {
      const state = createScoreState(SCORE_POINTS.THIRTY, SCORE_POINTS.LOVE)
      const result = addPoint(state, 'teamA')

      expect(result.teamA.points).toBe(SCORE_POINTS.FORTY)
    })

    it('does not mutate original state', () => {
      const state = createInitialMatchState()
      addPoint(state, 'teamA')

      expect(state.teamA.points).toBe(SCORE_POINTS.LOVE)
    })
  })

  describe('addPoint - game winning', () => {
    it('wins game from FORTY-LOVE', () => {
      const state = createScoreState(SCORE_POINTS.FORTY, SCORE_POINTS.LOVE)
      const result = addPoint(state, 'teamA')

      expect(result.teamA.games).toBe(1)
      expect(result.teamA.points).toBe(SCORE_POINTS.LOVE)
      expect(result.teamB.points).toBe(SCORE_POINTS.LOVE)
    })

    it('wins game from FORTY-FIFTEEN', () => {
      const state = createScoreState(SCORE_POINTS.FORTY, SCORE_POINTS.FIFTEEN)
      const result = addPoint(state, 'teamA')

      expect(result.teamA.games).toBe(1)
      expect(result.currentSetStatus.teamAGames).toBe(1)
    })

    it('wins game from FORTY-THIRTY', () => {
      const state = createScoreState(SCORE_POINTS.FORTY, SCORE_POINTS.THIRTY)
      const result = addPoint(state, 'teamA')

      expect(result.teamA.games).toBe(1)
    })

    it('resets points after game win', () => {
      const state = createScoreState(SCORE_POINTS.FORTY, SCORE_POINTS.THIRTY)
      const result = addPoint(state, 'teamA')

      expect(result.teamA.points).toBe(SCORE_POINTS.LOVE)
      expect(result.teamB.points).toBe(SCORE_POINTS.LOVE)
    })

    it('updates currentSetStatus games', () => {
      const state = createScoreState(SCORE_POINTS.FORTY, SCORE_POINTS.LOVE)
      const result = addPoint(state, 'teamA')

      expect(result.currentSetStatus.teamAGames).toBe(1)
      expect(result.currentSetStatus.teamBGames).toBe(0)
    })
  })

  describe('addPoint - deuce', () => {
    it('reaches deuce at FORTY-FORTY', () => {
      const state = createScoreState(SCORE_POINTS.FORTY, SCORE_POINTS.THIRTY)
      const result = addPoint(state, 'teamB')

      expect(result.teamA.points).toBe(SCORE_POINTS.FORTY)
      expect(result.teamB.points).toBe(SCORE_POINTS.FORTY)
    })

    it('gives advantage from deuce', () => {
      const state = createScoreState(SCORE_POINTS.FORTY, SCORE_POINTS.FORTY)
      const result = addPoint(state, 'teamA')

      expect(result.teamA.points).toBe(SCORE_POINTS.ADVANTAGE)
      expect(result.teamB.points).toBe(SCORE_POINTS.FORTY)
    })

    it('wins game from advantage', () => {
      const state = createScoreState(SCORE_POINTS.ADVANTAGE, SCORE_POINTS.FORTY)
      const result = addPoint(state, 'teamA')

      expect(result.teamA.games).toBe(1)
      expect(result.teamA.points).toBe(SCORE_POINTS.LOVE)
    })

    it('returns to deuce when opponent scores against advantage', () => {
      const state = createScoreState(SCORE_POINTS.ADVANTAGE, SCORE_POINTS.FORTY)
      const result = addPoint(state, 'teamB')

      expect(result.teamA.points).toBe(SCORE_POINTS.FORTY)
      expect(result.teamB.points).toBe(SCORE_POINTS.FORTY)
    })
  })

  describe('addPoint - tie break', () => {
    it('uses numeric scoring in tie break', () => {
      const state = createTieBreakState(0, 0)
      const result = addPoint(state, 'teamA')

      expect(result.teamA.points).toBe(1)
      expect(result.teamB.points).toBe(0)
    })

    it('increments tie break points sequentially', () => {
      const state = createTieBreakState(3, 2)
      const result = addPoint(state, 'teamB')

      expect(result.teamA.points).toBe(3)
      expect(result.teamB.points).toBe(3)
    })

    it('wins tie break at 7-0 and records set history', () => {
      const state = createTieBreakState(6, 0)
      const result = addPoint(state, 'teamA')

      expect(result.setsWon.teamA).toBe(1)
      expect(result.setHistory).toHaveLength(1)
      expect(result.setHistory[0]).toEqual({
        setNumber: 1,
        teamAGames: 7,
        teamBGames: 6
      })
    })

    it('does not win tie break at 7-6 (needs 2 point margin)', () => {
      const state = createTieBreakState(6, 6)
      const result = addPoint(state, 'teamA')

      expect(result.teamA.points).toBe(7)
      expect(result.teamA.games).toBe(6)
    })

    it('wins tie break at 8-6 and records set history', () => {
      const state = createTieBreakState(7, 6)
      const result = addPoint(state, 'teamA')

      expect(result.setsWon.teamA).toBe(1)
      expect(result.setHistory).toHaveLength(1)
    })
  })

  describe('addPoint - set winning', () => {
    it('wins set at 6-0 and moves to next set', () => {
      const state = createGameState(5, 0)
      state.teamA.points = SCORE_POINTS.FORTY
      state.teamB.points = SCORE_POINTS.LOVE

      const result = addPoint(state, 'teamA')

      expect(result.setsWon.teamA).toBe(1)
      expect(result.currentSetStatus.number).toBe(2)
      expect(result.currentSetStatus.teamAGames).toBe(0)
      expect(result.currentSetStatus.teamBGames).toBe(0)
    })

    it('does not win set at 6-5 (needs 2 game margin)', () => {
      const state = createGameState(5, 5)
      state.teamA.points = SCORE_POINTS.FORTY
      state.teamB.points = SCORE_POINTS.LOVE

      const result = addPoint(state, 'teamA')

      expect(result.currentSetStatus.teamAGames).toBe(6)
      expect(result.currentSetStatus.teamBGames).toBe(5)
      expect(result.setsWon.teamA).toBe(0)
    })

    it('wins set at 7-5 and moves to next set', () => {
      const state = createGameState(6, 5)
      state.teamA.points = SCORE_POINTS.FORTY
      state.teamB.points = SCORE_POINTS.LOVE

      const result = addPoint(state, 'teamA')

      expect(result.setsWon.teamA).toBe(1)
      expect(result.currentSetStatus.number).toBe(2)
    })

    it('resets games after set win', () => {
      const state = createGameState(5, 0)
      state.teamA.points = SCORE_POINTS.FORTY

      const result = addPoint(state, 'teamA')

      expect(result.currentSetStatus.teamAGames).toBe(0)
      expect(result.currentSetStatus.teamBGames).toBe(0)
    })
  })

  describe('addPoint - match winning', () => {
    it('wins match when winning 2 sets (best of 3)', () => {
      const state = createGameState(5, 0)
      state.teamA.points = SCORE_POINTS.FORTY
      state.setsWon = { teamA: 1, teamB: 0 }
      state.setsNeededToWin = 2

      const result = addPoint(state, 'teamA')

      expect(result.status).toBe('finished')
      expect(result.winnerTeam).toBe('teamA')
    })

    it('does not finish match after 1 set (best of 3)', () => {
      const state = createGameState(5, 0)
      state.teamA.points = SCORE_POINTS.FORTY
      state.setsWon = { teamA: 0, teamB: 0 }
      state.setsNeededToWin = 2

      const result = addPoint(state, 'teamA')

      expect(result.status).toBe('active')
      expect(result.currentSetStatus.number).toBe(2)
    })
  })

  describe('addPoint - finished match', () => {
    it('returns unchanged state when match is finished', () => {
      const state = createInitialMatchState()
      state.status = 'finished'
      state.winnerTeam = 'teamA'

      const result = addPoint(state, 'teamB')

      expect(result.status).toBe('finished')
      expect(result.winnerTeam).toBe('teamA')
    })
  })

  describe('addPoint - team validation', () => {
    it('throws for invalid team', () => {
      const state = createInitialMatchState()

      expect(() => addPoint(state, 'invalid')).toThrow(TypeError)
    })

    it('accepts teamA', () => {
      const state = createInitialMatchState()

      expect(() => addPoint(state, 'teamA')).not.toThrow()
    })

    it('accepts teamB', () => {
      const state = createInitialMatchState()

      expect(() => addPoint(state, 'teamB')).not.toThrow()
    })
  })

  describe('addPoint - history stack', () => {
    it('throws for invalid history stack', () => {
      const state = createInitialMatchState()
      const badHistory = {}

      expect(() => addPoint(state, 'teamA', badHistory)).toThrow(TypeError)
    })

    it('pushes state to history when provided', () => {
      const state = createInitialMatchState()
      const history = createHistoryStack()

      addPoint(state, 'teamA', history)

      expect(history.size()).toBe(1)
    })

    it('works without history stack', () => {
      const state = createInitialMatchState()

      expect(() => addPoint(state, 'teamA')).not.toThrow()
    })
  })

  describe('removePoint', () => {
    it('returns unchanged state at initial state', () => {
      const state = createInitialMatchState()
      const history = createHistoryStack()

      const result = removePoint(state, history)

      expect(result.teamA.points).toBe(SCORE_POINTS.LOVE)
      expect(result.teamB.points).toBe(SCORE_POINTS.LOVE)
    })

    it('restores previous state from history', () => {
      const state = createInitialMatchState()
      const history = createHistoryStack()

      const state1 = addPoint(state, 'teamA', history)
      const state2 = addPoint(state1, 'teamA', history)

      const undone = removePoint(state2, history)

      expect(undone.teamA.points).toBe(SCORE_POINTS.FIFTEEN)
    })

    it('returns unchanged when history is empty', () => {
      const state = createScoreState(SCORE_POINTS.FIFTEEN, SCORE_POINTS.LOVE)
      const history = createHistoryStack()

      const result = removePoint(state, history)

      expect(result.teamA.points).toBe(SCORE_POINTS.FIFTEEN)
    })

    it('works without history stack', () => {
      const state = createScoreState(SCORE_POINTS.FIFTEEN, SCORE_POINTS.LOVE)

      const result = removePoint(state)

      expect(result.teamA.points).toBe(SCORE_POINTS.FIFTEEN)
    })
  })

  describe('removePoint - state validation', () => {
    it('returns deep copy', () => {
      const state = createInitialMatchState()
      const history = createHistoryStack()

      const result = removePoint(state, history)
      result.teamA.games = 999

      expect(state.teamA.games).toBe(0)
    })

    it('throws for invalid history stack missing pop', () => {
      const state = createInitialMatchState()
      const badHistory = { push: () => {}, isEmpty: () => true }

      expect(() => removePoint(state, badHistory)).toThrow(TypeError)
    })

    it('throws for invalid history stack missing isEmpty', () => {
      const state = createInitialMatchState()
      const badHistory = { push: () => {}, pop: () => null }

      expect(() => removePoint(state, badHistory)).toThrow(TypeError)
    })
  })

  describe('full match simulation', () => {
    it('simulates complete game', () => {
      const state = createInitialMatchState()
      const history = createHistoryStack()

      let result = addPoint(state, 'teamA', history)
      expect(result.teamA.points).toBe(SCORE_POINTS.FIFTEEN)

      result = addPoint(result, 'teamA', history)
      expect(result.teamA.points).toBe(SCORE_POINTS.THIRTY)

      result = addPoint(result, 'teamA', history)
      expect(result.teamA.points).toBe(SCORE_POINTS.FORTY)

      result = addPoint(result, 'teamA', history)
      expect(result.teamA.games).toBe(1)
      expect(result.teamA.points).toBe(SCORE_POINTS.LOVE)
    })

    it('simulates deuce game', () => {
      const history = createHistoryStack()

      let state = createInitialMatchState()
      state = addPoint(state, 'teamA', history)
      state = addPoint(state, 'teamB', history)
      state = addPoint(state, 'teamA', history)
      state = addPoint(state, 'teamB', history)
      state = addPoint(state, 'teamA', history)
      state = addPoint(state, 'teamB', history)

      expect(state.teamA.points).toBe(SCORE_POINTS.FORTY)
      expect(state.teamB.points).toBe(SCORE_POINTS.FORTY)

      state = addPoint(state, 'teamA', history)
      expect(state.teamA.points).toBe(SCORE_POINTS.ADVANTAGE)

      state = addPoint(state, 'teamB', history)
      expect(state.teamA.points).toBe(SCORE_POINTS.FORTY)
      expect(state.teamB.points).toBe(SCORE_POINTS.FORTY)

      state = addPoint(state, 'teamA', history)
      state = addPoint(state, 'teamA', history)

      expect(state.teamA.games).toBe(1)
    })

    it('simulates undo sequence', () => {
      const history = createHistoryStack()

      let state = createInitialMatchState()
      state = addPoint(state, 'teamA', history)
      state = addPoint(state, 'teamA', history)
      state = addPoint(state, 'teamA', history)

      expect(state.teamA.points).toBe(SCORE_POINTS.FORTY)
      expect(history.size()).toBe(3)

      state = removePoint(state, history)
      expect(state.teamA.points).toBe(SCORE_POINTS.THIRTY)
      expect(history.size()).toBe(2)

      state = removePoint(state, history)
      expect(state.teamA.points).toBe(SCORE_POINTS.FIFTEEN)
      expect(history.size()).toBe(1)
    })
  })
})
