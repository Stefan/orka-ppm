/**
 * Unit tests for lib/pmr/co2-heuristic.ts
 */

import { estimateCO2, getScenarioCO2 } from '@/lib/pmr/co2-heuristic'

describe('estimateCO2', () => {
  it('returns 0 when budget and duration 0 and no factors', () => {
    expect(estimateCO2(0, 0, {})).toBe(0)
  })

  it('uses default factors when not provided', () => {
    const tco2 = estimateCO2(100000, 90)
    expect(tco2).toBeGreaterThan(0)
  })

  it('scales with budget when perThousandBudget set', () => {
    const f = { perThousandBudget: 0.01 }
    expect(estimateCO2(10000, 0, f)).toBe(0.1)
    expect(estimateCO2(100000, 0, f)).toBe(1)
  })

  it('scales with duration when perMonthDuration set', () => {
    const f = { perMonthDuration: 0.5 }
    expect(estimateCO2(0, 30, f)).toBe(0.5)
    expect(estimateCO2(0, 60, f)).toBe(1)
  })

  it('rounds to one decimal', () => {
    const tco2 = estimateCO2(12345, 67, undefined)
    expect(Number.isInteger(tco2 * 10)).toBe(true)
  })
})

describe('getScenarioCO2', () => {
  it('combines expected cost and schedule', () => {
    const tco2 = getScenarioCO2(50000, 120, null)
    expect(tco2).toBeGreaterThanOrEqual(0)
  })
})
