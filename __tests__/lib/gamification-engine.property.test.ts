/**
 * Property 39: Badge Criteria Validation (Task 48.5)
 * Validates: Requirements 44.6 - badges awarded only when criteria met.
 */

import * as fc from 'fast-check'
import { getEarnedBadges, getBadgeDescription, BadgeType, BadgeContext } from '@/lib/gamification-engine'

describe('Gamification Engine - Property 39: Badge Criteria Validation', () => {
  it('Property 39: first_comment badge only when commentsCount >= 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (count) => {
        const badges = getEarnedBadges({ commentsCount: count })
        if (count >= 1) {
          expect(badges).toContain('first_comment')
        } else {
          expect(badges).not.toContain('first_comment')
        }
      }),
      { numRuns: 20 }
    )
  })

  it('Property 39: first_import badge only when importsCount >= 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (count) => {
        const badges = getEarnedBadges({ importsCount: count })
        if (count >= 1) {
          expect(badges).toContain('first_import')
        } else {
          expect(badges).not.toContain('first_import')
        }
      }),
      { numRuns: 20 }
    )
  })

  it('Property 39: all returned badges have descriptions', () => {
    const context: BadgeContext = {
      commentsCount: 5,
      importsCount: 2,
      projectsOverBudgetResolved: 10,
      evmViewsCount: 15,
      vendorReviewsCount: 5
    }
    const badges = getEarnedBadges(context)
    for (const badge of badges) {
      const desc = getBadgeDescription(badge as BadgeType)
      expect(desc).toBeDefined()
      expect(typeof desc).toBe('string')
      expect(desc.length).toBeGreaterThan(0)
    }
  })
})
