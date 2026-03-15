import { describe, expect, it } from 'vitest'
import { SETS_TO_PLAY } from '../../utils/constants.js'
import { MATCH_STATUS } from '../../utils/match-state.js'

describe('match-state', () => {
  describe('MATCH_STATUS', () => {
    it('has ACTIVE status', () => {
      expect(MATCH_STATUS.ACTIVE).toBe('active')
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
})
