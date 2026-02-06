/**
 * Forecast-Sim: period-wise cash out using Distribution Rules (Cora-Doc).
 * Used to enrich sim results with spend per period / peak cash.
 * Requirements: R-PS1
 */

import { calculateDistribution } from '@/lib/costbook/distribution-engine'
import type { DistributionSettings } from '@/types/costbook'

export interface PeriodSpend {
  label: string
  amount: number
  percentage: number
}

export interface DistributionForecastResult {
  periods: PeriodSpend[]
  total: number
  peakCash: number
  profile: string
  error?: string
}

/**
 * Compute period-wise forecast (cash out) for a project using distribution settings.
 * Default: linear over project duration when settings not provided.
 */
export function getDistributionForecast(
  totalBudget: number,
  durationStart: string,
  durationEnd: string,
  settings?: Partial<DistributionSettings> | null,
  currentSpend?: number
): DistributionForecastResult {
  const effectiveSettings: DistributionSettings = {
    profile: settings?.profile ?? 'linear',
    duration_start: settings?.duration_start ?? durationStart,
    duration_end: settings?.duration_end ?? durationEnd,
    granularity: settings?.granularity ?? 'month',
    customDistribution: settings?.customDistribution,
  }

  const remainingBudget = Math.max(0, totalBudget - (currentSpend ?? 0))
  const result = calculateDistribution(remainingBudget, effectiveSettings, currentSpend)

  if (result.error) {
    return {
      periods: [],
      total: 0,
      peakCash: 0,
      profile: result.profile,
      error: result.error,
    }
  }

  const amounts = result.periods.map((p) => p.amount)
  const peakCash = amounts.length > 0 ? Math.max(...amounts) : 0

  return {
    periods: result.periods.map((p) => ({
      label: p.label,
      amount: p.amount,
      percentage: p.percentage,
    })),
    total: result.total,
    peakCash,
    profile: result.profile,
  }
}
