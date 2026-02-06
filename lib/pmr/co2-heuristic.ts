/**
 * Sustainability: CO2-Impact heuristic per scenario.
 * Optional factors (e.g. per-currency or per-category); when not configured, returns 0 or hide column.
 * Requirements: R-PS7
 */

export interface CO2Factors {
  /** tCO2e per 1k budget (currency-agnostic scale) */
  perThousandBudget?: number
  /** tCO2e per 30 days duration */
  perMonthDuration?: number
}

const DEFAULT_FACTORS: CO2Factors = {
  perThousandBudget: 0.002,
  perMonthDuration: 0.1,
}

/**
 * Estimate CO2 (tCO2e) for a scenario from budget and duration.
 * When factors not provided, uses defaults (can be overridden by tenant config).
 */
export function estimateCO2(
  budget: number,
  durationDays: number,
  factors?: CO2Factors | null
): number {
  const f = factors ?? DEFAULT_FACTORS
  let tco2 = 0
  if (f.perThousandBudget != null && budget > 0) {
    tco2 += (budget / 1000) * f.perThousandBudget
  }
  if (f.perMonthDuration != null && durationDays > 0) {
    tco2 += (durationDays / 30) * f.perMonthDuration
  }
  return Math.round(tco2 * 10) / 10
}

/**
 * Get CO2 for a scenario result (expected cost + schedule P50 as duration proxy).
 */
export function getScenarioCO2(
  expectedCost: number,
  p50ScheduleDays: number,
  factors?: CO2Factors | null
): number {
  return estimateCO2(expectedCost, p50ScheduleDays, factors)
}
