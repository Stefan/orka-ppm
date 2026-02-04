/**
 * Tests for lib/utils/formatting.ts
 */

import {
  formatCurrency,
  formatPercentage,
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  formatHours,
  formatConfidence,
  formatCompactNumber,
  formatDuration,
} from '../formatting'

describe('lib/utils/formatting', () => {
  describe('formatCurrency', () => {
    it('formats number as USD by default', () => {
      expect(formatCurrency(1234.5)).toMatch(/\$1[,.]234[.,]50/)
    })
    it('accepts currency and locale', () => {
      const out = formatCurrency(99.99, 'EUR', 'de-DE')
      expect(out).toMatch(/99[,.]99/)
    })
  })

  describe('formatPercentage', () => {
    it('converts decimal to percentage when isDecimal true', () => {
      expect(formatPercentage(0.456, 1, true)).toBe('45.6%')
    })
    it('uses value as-is when isDecimal false', () => {
      expect(formatPercentage(33.3, 1, false)).toBe('33.3%')
    })
    it('respects decimals', () => {
      expect(formatPercentage(0.1, 2, true)).toBe('10.00%')
    })
  })

  describe('formatDate', () => {
    it('formats Date to YYYY-MM-DD', () => {
      expect(formatDate(new Date('2024-06-15'))).toBe('2024-06-15')
    })
    it('accepts ISO string', () => {
      expect(formatDate('2024-01-01')).toBe('2024-01-01')
    })
    it('accepts timestamp', () => {
      expect(formatDate(new Date('2024-12-31').getTime())).toBe('2024-12-31')
    })
    it('returns Invalid Date for invalid input', () => {
      expect(formatDate(new Date('invalid'))).toBe('Invalid Date')
    })
  })

  describe('formatDateTime', () => {
    it('includes time part', () => {
      const s = formatDateTime(new Date('2024-06-15T14:30:00'))
      expect(s).toMatch(/2024-06-15/)
      expect(s).toMatch(/\d{2}:\d{2}:\d{2}/)
    })
    it('returns Invalid Date for invalid input', () => {
      expect(formatDateTime(new Date('invalid'))).toBe('Invalid Date')
    })
  })

  describe('formatTime', () => {
    it('formats as HH:MM', () => {
      expect(formatTime(new Date('2024-01-01T09:05:00'))).toBe('09:05')
    })
    it('returns Invalid Time for invalid input', () => {
      expect(formatTime(new Date('invalid'))).toBe('Invalid Time')
    })
  })

  describe('formatNumber', () => {
    it('formats with decimals', () => {
      expect(formatNumber(1234.5, 2)).toMatch(/1[,.]234[.,]50/)
    })
    it('defaults to 0 decimals', () => {
      expect(formatNumber(42)).toMatch(/42/)
    })
  })

  describe('formatHours', () => {
    it('formats with h suffix', () => {
      expect(formatHours(2.5)).toBe('2.5h')
    })
    it('respects decimals', () => {
      expect(formatHours(1, 2)).toBe('1.00h')
    })
  })

  describe('formatConfidence', () => {
    it('formats 0-1 as percentage', () => {
      expect(formatConfidence(0.85)).toBe('85%')
    })
  })

  describe('formatCompactNumber', () => {
    it('formats thousands with K', () => {
      expect(formatCompactNumber(1500)).toBe('1.5K')
    })
    it('formats millions with M', () => {
      expect(formatCompactNumber(2_500_000)).toBe('2.5M')
    })
    it('formats billions with B', () => {
      expect(formatCompactNumber(1.2e9)).toBe('1.2B')
    })
    it('formats small numbers without suffix', () => {
      expect(formatCompactNumber(99, 0)).toBe('99')
    })
  })

  describe('formatDuration', () => {
    it('formats ms', () => {
      expect(formatDuration(500)).toBe('500ms')
    })
    it('formats seconds', () => {
      expect(formatDuration(2500)).toBe('2.5s')
    })
    it('formats minutes', () => {
      expect(formatDuration(90000)).toBe('1.5m')
    })
    it('formats hours', () => {
      expect(formatDuration(7200000)).toBe('2.0h')
    })
  })
})
