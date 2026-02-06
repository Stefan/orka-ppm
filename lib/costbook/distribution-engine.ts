// Distribution Engine for Cash Out Forecast Planning
// Phase 2 & 3: Distribution Settings and Rules Engine

import { DistributionSettings, DistributionProfile, DistributionRule, DistributionRuleType } from '@/types/costbook'

export interface DistributionPeriod {
  id: string
  start_date: string
  end_date: string
  amount: number
  percentage: number
  label: string
}

export interface DistributionResult {
  periods: DistributionPeriod[]
  total: number
  profile: DistributionProfile
  confidence?: number
  error?: string
}

export interface RuleTrigger {
  event: 'commitment_added' | 'actual_posted' | 'budget_changed' | 'schedule'
  condition?: string
  schedule?: string
}

/**
 * Calculate time periods based on start date, end date, and granularity
 */
export function calculatePeriods(
  startDate: string,
  endDate: string,
  granularity: 'week' | 'month'
): DistributionPeriod[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const periods: DistributionPeriod[] = []

  let current = new Date(start)
  let periodIndex = 0

  while (current < end) {
    const periodStart = new Date(current)
    let periodEnd: Date

    if (granularity === 'week') {
      periodEnd = new Date(current)
      periodEnd.setDate(periodEnd.getDate() + 7)
    } else {
      periodEnd = new Date(current)
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    // Don't exceed end date
    if (periodEnd > end) {
      periodEnd = new Date(end)
    }

    const label = granularity === 'week'
      ? `Week ${periodIndex + 1} (${formatDate(periodStart)})`
      : `${formatMonthYear(periodStart)}`

    periods.push({
      id: `${granularity}-${periodIndex}`,
      start_date: periodStart.toISOString(),
      end_date: periodEnd.toISOString(),
      amount: 0, // Will be set by distribution calculation
      percentage: 0, // Will be set by distribution calculation
      label
    })

    current = periodEnd
    periodIndex++
  }

  return periods
}

/**
 * Apply linear distribution to periods
 */
export function applyLinearDistribution(
  totalBudget: number,
  periods: DistributionPeriod[]
): DistributionResult {
  if (periods.length === 0) {
    return {
      periods: [],
      total: 0,
      profile: 'linear',
      error: 'No periods available'
    }
  }

  const amountPerPeriod = totalBudget / periods.length
  const percentagePerPeriod = 100 / periods.length

  const distributedPeriods = periods.map(period => ({
    ...period,
    amount: amountPerPeriod,
    percentage: percentagePerPeriod
  }))

  return {
    periods: distributedPeriods,
    total: totalBudget,
    profile: 'linear'
  }
}

/**
 * Apply custom distribution to periods
 */
export function applyCustomDistribution(
  totalBudget: number,
  periods: DistributionPeriod[],
  customPercentages: number[]
): DistributionResult {
  if (periods.length === 0) {
    return {
      periods: [],
      total: 0,
      profile: 'custom',
      error: 'No periods available'
    }
  }

  if (customPercentages.length !== periods.length) {
    return {
      periods: [],
      total: 0,
      profile: 'custom',
      error: `Expected ${periods.length} percentages, got ${customPercentages.length}`
    }
  }

  const sum = customPercentages.reduce((acc, p) => acc + p, 0)
  if (Math.abs(sum - 100) > 0.01) {
    return {
      periods: [],
      total: 0,
      profile: 'custom',
      error: `Percentages must sum to 100%, got ${sum.toFixed(2)}%`
    }
  }

  const distributedPeriods = periods.map((period, i) => ({
    ...period,
    amount: (totalBudget * customPercentages[i]) / 100,
    percentage: customPercentages[i]
  }))

  return {
    periods: distributedPeriods,
    total: totalBudget,
    profile: 'custom'
  }
}

/**
 * Generate AI-powered distribution based on historical patterns
 * Phase 3: This is a simplified version; full ML model would be in backend
 */
export function generateAIDistribution(
  totalBudget: number,
  periods: DistributionPeriod[],
  projectFeatures?: {
    projectType?: string
    historicalSpendPattern?: number[]
    seasonalityFactors?: number[]
  }
): DistributionResult {
  if (periods.length === 0) {
    return {
      periods: [],
      total: 0,
      profile: 'ai_generated',
      error: 'No periods available'
    }
  }

  // Simplified AI: Use historical pattern if available, otherwise S-curve
  let percentages: number[]

  if (projectFeatures?.historicalSpendPattern && 
      projectFeatures.historicalSpendPattern.length === periods.length) {
    // Normalize historical pattern
    const sum = projectFeatures.historicalSpendPattern.reduce((a, b) => a + b, 0)
    percentages = projectFeatures.historicalSpendPattern.map(p => (p / sum) * 100)
  } else {
    // Default: S-curve distribution (slow start, ramp up, slow end)
    percentages = generateSCurveDistribution(periods.length)
  }

  const distributedPeriods = periods.map((period, i) => ({
    ...period,
    amount: (totalBudget * percentages[i]) / 100,
    percentage: percentages[i]
  }))

  return {
    periods: distributedPeriods,
    total: totalBudget,
    profile: 'ai_generated',
    confidence: 0.85 // Mock confidence score
  }
}

/**
 * Generate S-curve distribution percentages
 * Typical project spending: 15-20-30-25-10 pattern
 */
function generateSCurveDistribution(periodCount: number): number[] {
  const percentages: number[] = []
  
  for (let i = 0; i < periodCount; i++) {
    // Normalized position (0 to 1)
    const x = i / (periodCount - 1)
    
    // S-curve formula (logistic function)
    const sCurve = 1 / (1 + Math.exp(-10 * (x - 0.5)))
    
    percentages.push(sCurve)
  }

  // Convert to percentages (derivative = spending per period)
  const derivatives: number[] = []
  for (let i = 0; i < percentages.length; i++) {
    if (i === 0) {
      derivatives.push(percentages[i])
    } else {
      derivatives.push(percentages[i] - percentages[i - 1])
    }
  }

  // Normalize to 100%
  const sum = derivatives.reduce((a, b) => a + b, 0)
  return derivatives.map(d => (d / sum) * 100)
}

/**
 * Apply reprofiling based on actual consumption
 * Phase 3: Adjusts remaining distribution based on spend-to-date
 */
export function applyReprofiling(
  totalBudget: number,
  currentSpend: number,
  periods: DistributionPeriod[],
  currentDate: Date = new Date()
): DistributionResult {
  if (periods.length === 0) {
    return {
      periods: [],
      total: 0,
      profile: 'linear',
      error: 'No periods available'
    }
  }

  const remainingBudget = totalBudget - currentSpend

  if (remainingBudget <= 0) {
    return {
      periods: periods.map(p => ({ ...p, amount: 0, percentage: 0 })),
      total: 0,
      profile: 'linear',
      error: 'Budget fully consumed'
    }
  }

  // Find remaining periods (future periods only)
  const remainingPeriods = periods.filter(
    p => new Date(p.start_date) >= currentDate
  )

  if (remainingPeriods.length === 0) {
    return {
      periods: periods.map(p => ({ ...p, amount: 0, percentage: 0 })),
      total: 0,
      profile: 'linear',
      error: 'No remaining periods'
    }
  }

  // Redistribute remaining budget linearly
  const amountPerPeriod = remainingBudget / remainingPeriods.length
  const percentagePerPeriod = 100 / remainingPeriods.length

  const distributedPeriods = periods.map(period => {
    const isFuture = new Date(period.start_date) >= currentDate
    return {
      ...period,
      amount: isFuture ? amountPerPeriod : 0,
      percentage: isFuture ? percentagePerPeriod : 0
    }
  })

  return {
    periods: distributedPeriods,
    total: remainingBudget,
    profile: 'linear'
  }
}

/**
 * Variance metric for distribution (sum of squared deviations from equal share).
 * Used to estimate variance impact when changing profile/duration (predictive rules).
 * Linear = 0; higher = more uneven.
 */
export function getDistributionVarianceMetric(result: DistributionResult): number {
  if (result.periods.length === 0) return 0
  const n = result.periods.length
  const equal = 100 / n
  return result.periods.reduce((sum, p) => sum + (p.percentage - equal) ** 2, 0)
}

/**
 * Validate custom distribution percentages
 */
export function validateCustomDistribution(percentages: number[]): {
  valid: boolean
  error?: string
} {
  if (percentages.length === 0) {
    return { valid: false, error: 'At least one period is required' }
  }

  if (percentages.some(p => p < 0)) {
    return { valid: false, error: 'Percentages cannot be negative' }
  }

  const sum = percentages.reduce((a, b) => a + b, 0)
  if (Math.abs(sum - 100) > 0.01) {
    return { valid: false, error: `Percentages must sum to 100%, got ${sum.toFixed(2)}%` }
  }

  return { valid: true }
}

/**
 * Calculate distribution based on settings
 */
export function calculateDistribution(
  totalBudget: number,
  settings: DistributionSettings,
  currentSpend?: number
): DistributionResult {
  const periods = calculatePeriods(
    settings.duration_start,
    settings.duration_end,
    settings.granularity
  )

  switch (settings.profile) {
    case 'linear':
      return applyLinearDistribution(totalBudget, periods)
    
    case 'custom':
      if (!settings.customDistribution) {
        return {
          periods: [],
          total: 0,
          profile: 'custom',
          error: 'Custom distribution requires percentages'
        }
      }
      return applyCustomDistribution(totalBudget, periods, settings.customDistribution)
    
    case 'ai_generated':
      return generateAIDistribution(totalBudget, periods)
    
    default:
      return {
        periods: [],
        total: 0,
        profile: settings.profile,
        error: 'Unknown profile type'
      }
  }
}

// Utility functions
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
