/**
 * Unit tests for lib/pmr/distribution-forecast.ts
 */

import { getDistributionForecast } from '@/lib/pmr/distribution-forecast'

describe('getDistributionForecast', () => {
  const start = '2024-01-01'
  const end = '2024-12-31'

  it('returns linear forecast when no settings', () => {
    const result = getDistributionForecast(120000, start, end, null)
    expect(result.profile).toBe('linear')
    expect(result.periods.length).toBeGreaterThan(0)
    expect(result.total).toBe(120000)
    expect(result.peakCash).toBeGreaterThan(0)
    expect(result.error).toBeUndefined()
  })

  it('uses custom duration from settings', () => {
    const result = getDistributionForecast(10000, start, end, {
      profile: 'linear',
      duration_start: '2024-06-01',
      duration_end: '2024-08-31',
      granularity: 'month',
    })
    expect(result.periods.length).toBeLessThanOrEqual(3)
    expect(result.total).toBe(10000)
  })

  it('returns error for custom profile without customDistribution', () => {
    const result = getDistributionForecast(10000, start, end, {
      profile: 'custom',
      duration_start: start,
      duration_end: end,
      granularity: 'month',
    })
    expect(result.error).toBeDefined()
    expect(result.periods).toHaveLength(0)
  })

  it('applies currentSpend to remaining budget', () => {
    const result = getDistributionForecast(100000, start, end, { profile: 'linear' }, 20000)
    expect(result.total).toBe(80000)
  })

  it('defaults to linear when settings undefined', () => {
    const result = getDistributionForecast(50000, start, end)
    expect(result.profile).toBe('linear')
    expect(result.periods.length).toBeGreaterThan(0)
  })
})
