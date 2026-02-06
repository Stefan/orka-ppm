/**
 * Unit tests for lib/pmr/scenario-heatmap-utils.ts
 */

import {
  getScenarioMetricRow,
  getCellColor,
  getHeatmapRows,
  type ScenarioMetricRow,
} from '@/lib/pmr/scenario-heatmap-utils'

describe('getScenarioMetricRow', () => {
  it('extracts metrics from results', () => {
    const row = getScenarioMetricRow(
      's1',
      'Baseline',
      {
        results: {
          budget_analysis: {
            percentiles: { p50: 1000, p90: 1200 },
            expected_final_cost: 1100,
          },
          schedule_analysis: {
            percentiles: { p50: 100 },
            expected_final_duration: 105,
          },
        },
      },
      5.2
    )
    expect(row.scenarioId).toBe('s1')
    expect(row.scenarioName).toBe('Baseline')
    expect(row.p50Budget).toBe(1000)
    expect(row.p90Budget).toBe(1200)
    expect(row.expectedCost).toBe(1100)
    expect(row.p50Schedule).toBe(100)
    expect(row.co2Tco2e).toBe(5.2)
  })

  it('handles missing results', () => {
    const row = getScenarioMetricRow('s2', 'Empty', undefined)
    expect(row.p50Budget).toBe(0)
    expect(row.expectedCost).toBe(0)
    expect(row.p50Schedule).toBe(0)
  })
})

describe('getCellColor', () => {
  it('returns green when value lower than baseline (cost)', () => {
    expect(getCellColor(800, 1000, 'expectedCost')).toBe('green')
  })
  it('returns red when value higher than baseline (cost)', () => {
    expect(getCellColor(1200, 1000, 'p90Budget')).toBe('red')
  })
  it('returns neutral when equal', () => {
    expect(getCellColor(1000, 1000, 'p50Budget')).toBe('neutral')
  })
  it('schedule: lower is better', () => {
    expect(getCellColor(80, 100, 'p50Schedule')).toBe('green')
    expect(getCellColor(120, 100, 'p50Schedule')).toBe('red')
  })
})

describe('getHeatmapRows', () => {
  it('returns empty when no rows', () => {
    expect(getHeatmapRows([])).toEqual([])
  })

  it('builds cells with colors vs baseline', () => {
    const rows: ScenarioMetricRow[] = [
      { scenarioId: 'b', scenarioName: 'Baseline', p50Budget: 1000, p90Budget: 1200, expectedCost: 1100, p50Schedule: 100 },
      { scenarioId: 's', scenarioName: 'Better', p50Budget: 900, p90Budget: 1100, expectedCost: 1000, p50Schedule: 90 },
    ]
    const out = getHeatmapRows(rows, 0)
    expect(out).toHaveLength(2)
    expect(out[0].cells.p50Budget.color).toBe('neutral')
    expect(out[1].cells.p50Budget.color).toBe('green')
    expect(out[1].cells.expectedCost.color).toBe('green')
  })
})
