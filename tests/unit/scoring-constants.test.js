import { describe, expect, it } from 'vitest'
import {
  SCORE_POINT_SEQUENCE,
  SCORE_POINTS
} from '../../utils/scoring-constants.js'

describe('scoring-constants', () => {
  describe('SCORE_POINTS', () => {
    it('is frozen/immutable', () => {
      expect(Object.isFrozen(SCORE_POINTS)).toBe(true)
    })

    it('has LOVE as 0', () => {
      expect(SCORE_POINTS.LOVE).toBe(0)
    })

    it('has FIFTEEN as 15', () => {
      expect(SCORE_POINTS.FIFTEEN).toBe(15)
    })

    it('has THIRTY as 30', () => {
      expect(SCORE_POINTS.THIRTY).toBe(30)
    })

    it('has FORTY as 40', () => {
      expect(SCORE_POINTS.FORTY).toBe(40)
    })

    it('has ADVANTAGE as string "Ad"', () => {
      expect(SCORE_POINTS.ADVANTAGE).toBe('Ad')
    })

    it('has GAME as string "Game"', () => {
      expect(SCORE_POINTS.GAME).toBe('Game')
    })
  })

  describe('SCORE_POINT_SEQUENCE', () => {
    it('is frozen/immutable', () => {
      expect(Object.isFrozen(SCORE_POINT_SEQUENCE)).toBe(true)
    })

    it('has 6 elements', () => {
      expect(SCORE_POINT_SEQUENCE).toHaveLength(6)
    })

    it('follows correct progression order', () => {
      expect(SCORE_POINT_SEQUENCE[0]).toBe(SCORE_POINTS.LOVE)
      expect(SCORE_POINT_SEQUENCE[1]).toBe(SCORE_POINTS.FIFTEEN)
      expect(SCORE_POINT_SEQUENCE[2]).toBe(SCORE_POINTS.THIRTY)
      expect(SCORE_POINT_SEQUENCE[3]).toBe(SCORE_POINTS.FORTY)
      expect(SCORE_POINT_SEQUENCE[4]).toBe(SCORE_POINTS.ADVANTAGE)
      expect(SCORE_POINT_SEQUENCE[5]).toBe(SCORE_POINTS.GAME)
    })

    it('matches SCORE_POINTS values', () => {
      SCORE_POINT_SEQUENCE.forEach((point, index) => {
        const expectedValues = [
          SCORE_POINTS.LOVE,
          SCORE_POINTS.FIFTEEN,
          SCORE_POINTS.THIRTY,
          SCORE_POINTS.FORTY,
          SCORE_POINTS.ADVANTAGE,
          SCORE_POINTS.GAME
        ]
        expect(point).toBe(expectedValues[index])
      })
    })
  })
})
