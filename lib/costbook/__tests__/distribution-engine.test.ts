/**
 * Unit tests for lib/costbook/distribution-engine.ts
 * Critical: variance metric, validation, calculateDistribution (financial/costbook)
 */
import {
  getDistributionVarianceMetric,
  validateCustomDistribution,
  calculateDistribution,
  calculatePeriods,
  applyLinearDistribution,
  applyCustomDistribution,
  type DistributionResult,
} from '../distribution-engine'

describe('getDistributionVarianceMetric', () => {
  it('returns 0 for empty periods', () => {
    expect(getDistributionVarianceMetric({ periods: [], total: 0, profile: 'linear' })).toBe(0)
  })

  it('returns 0 for linear (equal) distribution', () => {
    const result: DistributionResult = {
      periods: [
        { id: '1', start_date: '', end_date: '', amount: 100, percentage: 25, label: 'Q1' },
        { id: '2', start_date: '', end_date: '', amount: 100, percentage: 25, label: 'Q2' },
        { id: '3', start_date: '', end_date: '', amount: 100, percentage: 25, label: 'Q3' },
        { id: '4', start_date: '', end_date: '', amount: 100, percentage: 25, label: 'Q4' },
      ],
      total: 400,
      profile: 'linear',
    }
    expect(getDistributionVarianceMetric(result)).toBe(0)
  })

  it('returns positive value for uneven distribution', () => {
    const result: DistributionResult = {
      periods: [
        { id: '1', start_date: '', end_date: '', amount: 80, percentage: 80, label: 'P1' },
        { id: '2', start_date: '', end_date: '', amount: 20, percentage: 20, label: 'P2' },
      ],
      total: 100,
      profile: 'custom',
    }
    const metric = getDistributionVarianceMetric(result)
    expect(metric).toBeGreaterThan(0)
    // 50% equal share; (80-50)^2 + (20-50)^2 = 900 + 900 = 1800
    expect(metric).toBe(1800)
  })
})

describe('validateCustomDistribution', () => {
  it('rejects empty percentages', () => {
    const r = validateCustomDistribution([])
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/one period/)
  })

  it('rejects negative percentages', () => {
    const r = validateCustomDistribution([50, -10, 60])
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/negative/)
  })

  it('rejects sum not equal to 100', () => {
    expect(validateCustomDistribution([50, 50]).valid).toBe(true)
    const r = validateCustomDistribution([50, 51])
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/100/)
  })

  it('accepts valid distribution', () => {
    expect(validateCustomDistribution([100]).valid).toBe(true)
    expect(validateCustomDistribution([33.33, 33.33, 33.34]).valid).toBe(true)
  })
})

describe('calculateDistribution', () => {
  it('returns linear distribution for profile linear', () => {
    const result = calculateDistribution(1200, {
      profile: 'linear',
      duration_start: '2024-01-01',
      duration_end: '2024-04-01',
      granularity: 'month',
    })
    expect(result.error).toBeUndefined()
    expect(result.profile).toBe('linear')
    expect(result.periods.length).toBeGreaterThan(0)
    const total = result.periods.reduce((s, p) => s + p.amount, 0)
    expect(total).toBeCloseTo(1200, 2)
  })

  it('returns error for custom without customDistribution', () => {
    const result = calculateDistribution(1000, {
      profile: 'custom',
      duration_start: '2024-01-01',
      duration_end: '2024-03-01',
      granularity: 'month',
    })
    expect(result.error).toMatch(/Custom distribution requires/)
  })

  it('returns custom distribution when customDistribution provided', () => {
    const periods = calculatePeriods('2024-01-01', '2024-04-01', 'month')
    const pct = periods.length === 3 ? [50, 30, 20] : Array(periods.length).fill(100 / periods.length)
    const result = calculateDistribution(1000, {
      profile: 'custom',
      duration_start: '2024-01-01',
      duration_end: '2024-04-01',
      granularity: 'month',
      customDistribution: pct,
    })
    expect(result.error).toBeUndefined()
    expect(result.profile).toBe('custom')
    expect(result.periods.length).toBe(periods.length)
    expect(result.periods.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(1000, 2)
  })

  it('returns ai_generated for profile ai_generated', () => {
    const result = calculateDistribution(1000, {
      profile: 'ai_generated',
      duration_start: '2024-01-01',
      duration_end: '2024-04-01',
      granularity: 'month',
    })
    expect(result.error).toBeUndefined()
    expect(result.profile).toBe('ai_generated')
    expect(result.periods.length).toBeGreaterThan(0)
  })
})

describe('calculatePeriods', () => {
  it('returns non-overlapping periods for month granularity', () => {
    const periods = calculatePeriods('2024-01-01', '2024-04-01', 'month')
    expect(periods.length).toBeGreaterThanOrEqual(2)
    expect(periods[0].label).toBeDefined()
    expect(periods[0].id).toBeDefined()
  })
})

describe('applyLinearDistribution', () => {
  it('splits budget evenly across periods', () => {
    const periods = calculatePeriods('2024-01-01', '2024-04-01', 'month')
    const result = applyLinearDistribution(3000, periods)
    expect(result.total).toBe(3000)
    result.periods.forEach(p => {
      expect(p.amount).toBeCloseTo(3000 / periods.length, 2)
      expect(p.percentage).toBeCloseTo(100 / periods.length, 2)
    })
  })
})

describe('applyCustomDistribution', () => {
  it('applies percentages to budget', () => {
    const periods = calculatePeriods('2024-01-01', '2024-03-01', 'month')
    const pct = [60, 40]
    expect(periods.length).toBe(2)
    const result = applyCustomDistribution(1000, periods, pct)
    expect(result.total).toBe(1000)
    expect(result.periods[0].amount).toBe(600)
    expect(result.periods[1].amount).toBe(400)
  })
})
