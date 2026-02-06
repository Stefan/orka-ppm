// Gamification Engine for Costbook (Task 48)

export type BadgeType = 'first_comment' | 'first_import' | 'budget_master' | 'evm_expert' | 'vendor_reviewer' | 'best_scenario'

export interface BadgeCriteria {
  badge_type: BadgeType
  description: string
  check: (context: BadgeContext) => boolean
}

export interface BadgeContext {
  commentsCount?: number
  importsCount?: number
  projectsOverBudgetResolved?: number
  evmViewsCount?: number
  vendorReviewsCount?: number
  /** Predictive Sim: user chose a scenario as best (e.g. from heatmap or AI suggestions) */
  bestScenarioChosen?: boolean
  /** Predictive Sim: number of scenarios better than baseline (cost/schedule) */
  scenariosBetterThanBaseline?: number
}

const BADGE_CRITERIA: BadgeCriteria[] = [
  {
    badge_type: 'first_comment',
    description: 'Post your first comment',
    check: (ctx) => (ctx.commentsCount ?? 0) >= 1
  },
  {
    badge_type: 'first_import',
    description: 'Complete your first CSV import',
    check: (ctx) => (ctx.importsCount ?? 0) >= 1
  },
  {
    badge_type: 'budget_master',
    description: 'Resolve 5 over-budget projects',
    check: (ctx) => (ctx.projectsOverBudgetResolved ?? 0) >= 5
  },
  {
    badge_type: 'evm_expert',
    description: 'View EVM metrics 10 times',
    check: (ctx) => (ctx.evmViewsCount ?? 0) >= 10
  },
  {
    badge_type: 'vendor_reviewer',
    description: 'Review 3 vendor score cards',
    check: (ctx) => (ctx.vendorReviewsCount ?? 0) >= 3
  },
  {
    badge_type: 'best_scenario',
    description: 'Choose a best scenario in Predictive Sim (heatmap or AI)',
    check: (ctx) => (ctx.bestScenarioChosen === true) || ((ctx.scenariosBetterThanBaseline ?? 0) >= 1)
  }
]

/**
 * Check which badges the user has earned given current context.
 */
export function getEarnedBadges(context: BadgeContext): BadgeType[] {
  return BADGE_CRITERIA.filter(c => c.check(context)).map(c => c.badge_type)
}

/**
 * Get badge metadata.
 */
export function getBadgeDescription(badgeType: BadgeType): string {
  return BADGE_CRITERIA.find(c => c.badge_type === badgeType)?.description ?? badgeType
}
