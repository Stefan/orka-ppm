/**
 * Multi-Scenario Heatmap: data and color helpers.
 * Baseline = first scenario or explicitly marked; green = better, red = worse.
 * Requirements: R-PS3
 */

export type HeatmapCellColor = 'green' | 'red' | 'neutral'

export interface ScenarioMetricRow {
  scenarioId: string
  scenarioName: string
  p50Budget: number
  p90Budget: number
  expectedCost: number
  p50Schedule: number
  co2Tco2e?: number
}

export interface HeatmapCell {
  value: number | string
  color: HeatmapCellColor
  rawValue: number
}

/**
 * Extract metric row from a scenario with results (MonteCarloResults shape).
 */
export function getScenarioMetricRow(
  scenarioId: string,
  scenarioName: string,
  results: { results?: { budget_analysis?: { percentiles?: { p50?: number; p90?: number }; expected_final_cost?: number }; schedule_analysis?: { percentiles?: { p50?: number }; expected_final_duration?: number } } } | undefined,
  co2Tco2e?: number
): ScenarioMetricRow {
  const budget = results?.results?.budget_analysis
  const schedule = results?.results?.schedule_analysis
  return {
    scenarioId,
    scenarioName,
    p50Budget: budget?.percentiles?.p50 ?? 0,
    p90Budget: budget?.percentiles?.p90 ?? 0,
    expectedCost: budget?.expected_final_cost ?? budget?.percentiles?.p50 ?? 0,
    p50Schedule: schedule?.percentiles?.p50 ?? schedule?.expected_final_duration ?? 0,
    co2Tco2e,
  }
}

/**
 * For cost metrics: lower is better (green when value < baseline).
 * For schedule: lower is better (green when value < baseline).
 */
export function getCellColor(
  value: number,
  baselineValue: number,
  metric: 'p50Budget' | 'p90Budget' | 'expectedCost' | 'p50Schedule' | 'co2Tco2e'
): HeatmapCellColor {
  if (value === baselineValue) return 'neutral'
  const lowerIsBetter = true // cost and schedule: lower is better
  if (lowerIsBetter) {
    return value < baselineValue ? 'green' : 'red'
  }
  return value > baselineValue ? 'green' : 'red'
}

/**
 * Build heatmap rows from scenarios; baselineIndex defaults to 0.
 */
export function getHeatmapRows(
  rows: ScenarioMetricRow[],
  baselineIndex: number = 0
): Array<ScenarioMetricRow & { cells: Record<keyof Omit<ScenarioMetricRow, 'scenarioId' | 'scenarioName'>, HeatmapCell> }> {
  const baseline = rows[baselineIndex]
  if (!baseline) return []

  return rows.map((row) => {
    const metrics: (keyof Omit<ScenarioMetricRow, 'scenarioId' | 'scenarioName'>)[] = [
      'p50Budget',
      'p90Budget',
      'expectedCost',
      'p50Schedule',
    ]
    const cells: Record<string, HeatmapCell> = {}
    for (const key of metrics) {
      const val = row[key] as number
      const baseVal = baseline[key] as number
      cells[key] = {
        value: key === 'p50Schedule' ? `${Number(val).toFixed(0)} d` : `$${Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        rawValue: val,
        color: getCellColor(val, baseVal, key as 'p50Budget' | 'p90Budget' | 'expectedCost' | 'p50Schedule'),
      }
    }
    if (row.co2Tco2e != null && baseline.co2Tco2e != null) {
      cells.co2Tco2e = {
        value: `${row.co2Tco2e.toFixed(1)} tCO2e`,
        rawValue: row.co2Tco2e,
        color: getCellColor(row.co2Tco2e, baseline.co2Tco2e, 'co2Tco2e'),
      }
    }
    return { ...row, cells }
  })
}
