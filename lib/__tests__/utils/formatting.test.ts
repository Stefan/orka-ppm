/**
 * Unit tests for lib/utils/formatting.ts
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
  formatFileSize,
  formatRelativeTime,
  truncateText,
  formatSeverity
} from '../../utils/formatting'

describe('lib/utils/formatting', () => {
  describe('formatCurrency', () => {
    it('formats number with default USD and en-US', () => {
      expect(formatCurrency(1234.56)).toMatch(/1,234\.56/)
      expect(formatCurrency(1234.56)).toMatch(/\$|USD/)
    })
    it('accepts currency and locale', () => {
      const s = formatCurrency(100, 'EUR', 'de-DE')
      expect(s).toContain('100')
    })
  })

  describe('formatPercentage', () => {
    it('formats decimal (0-1) by default', () => {
      expect(formatPercentage(0.5)).toBe('50.0%')
    })
    it('formats as percentage when isDecimal false', () => {
      expect(formatPercentage(50, 0, false)).toBe('50%')
    })
    it('respects decimals', () => {
      expect(formatPercentage(0.1234, 2)).toBe('12.34%')
    })
  })

  describe('formatDate', () => {
    it('formats Date to YYYY-MM-DD', () => {
      expect(formatDate(new Date('2024-06-15'))).toBe('2024-06-15')
    })
    it('formats string date', () => {
      expect(formatDate('2024-01-01')).toBe('2024-01-01')
    })
    it('formats timestamp', () => {
      expect(formatDate(new Date('2023-12-25').getTime())).toBe('2023-12-25')
    })
    it('returns Invalid Date for invalid input', () => {
      expect(formatDate(new Date('invalid'))).toBe('Invalid Date')
    })
  })

  describe('formatDateTime', () => {
    it('formats to YYYY-MM-DD HH:MM:SS', () => {
      const s = formatDateTime(new Date('2024-06-15T14:30:00'))
      expect(s).toMatch(/2024-06-15/)
      expect(s).toMatch(/\d{2}:\d{2}:\d{2}/)
    })
    it('returns Invalid Date for invalid input', () => {
      expect(formatDateTime(new Date('x'))).toBe('Invalid Date')
    })
  })

  describe('formatTime', () => {
    it('formats to HH:MM', () => {
      const d = new Date('2024-01-01T09:05:00')
      expect(formatTime(d)).toBe('09:05')
    })
    it('returns Invalid Time for invalid input', () => {
      expect(formatTime(new Date('invalid'))).toBe('Invalid Time')
    })
  })

  describe('formatNumber', () => {
    it('formats with default 0 decimals', () => {
      expect(formatNumber(1234)).toContain('1')
      expect(formatNumber(1234)).toContain('234')
    })
    it('respects decimals and locale', () => {
      expect(formatNumber(1234.5, 2)).toContain('234')
      expect(formatNumber(1234.5, 2)).toContain('50')
    })
  })

  describe('formatHours', () => {
    it('formats with h suffix', () => {
      expect(formatHours(2.5)).toBe('2.5h')
    })
    it('respects decimals', () => {
      expect(formatHours(1.234, 2)).toBe('1.23h')
    })
  })

  describe('formatConfidence', () => {
    it('formats 0-1 as percentage', () => {
      expect(formatConfidence(0.95)).toBe('95%')
    })
  })

  describe('formatCompactNumber', () => {
    it('formats B for billions', () => {
      expect(formatCompactNumber(1_500_000_000)).toBe('1.5B')
    })
    it('formats M for millions', () => {
      expect(formatCompactNumber(2_500_000)).toBe('2.5M')
    })
    it('formats K for thousands', () => {
      expect(formatCompactNumber(5_500)).toBe('5.5K')
    })
    it('formats small numbers with decimals', () => {
      expect(formatCompactNumber(1.23)).toBe('1.2')
    })
  })

  describe('formatDuration', () => {
    it('returns ms for < 1000', () => {
      expect(formatDuration(500)).toBe('500ms')
    })
    it('returns s for seconds', () => {
      expect(formatDuration(5000)).toBe('5.0s')
    })
    it('returns m for minutes', () => {
      expect(formatDuration(120000)).toBe('2.0m')
    })
    it('returns h for hours', () => {
      expect(formatDuration(7200000)).toBe('2.0h')
    })
  })

  describe('formatFileSize', () => {
    it('returns B for < 1024', () => {
      expect(formatFileSize(500)).toBe('500B')
    })
    it('returns KB', () => {
      expect(formatFileSize(2048)).toBe('2.0KB')
    })
    it('returns MB', () => {
      expect(formatFileSize(1024 * 1024 * 2)).toBe('2.0MB')
    })
    it('returns GB', () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 3)).toBe('3.0GB')
    })
  })

  describe('formatRelativeTime', () => {
    it('returns just now for recent', () => {
      expect(formatRelativeTime(new Date())).toBe('just now')
    })
    it('returns N minutes ago', () => {
      const d = new Date(Date.now() - 5 * 60 * 1000)
      expect(formatRelativeTime(d)).toBe('5 minutes ago')
    })
    it('returns 1 minute ago for singular', () => {
      const d = new Date(Date.now() - 1 * 60 * 1000)
      expect(formatRelativeTime(d)).toBe('1 minute ago')
    })
    it('returns Invalid Date for invalid input', () => {
      expect(formatRelativeTime(new Date('x'))).toBe('Invalid Date')
    })
  })

  describe('truncateText', () => {
    it('returns text if within maxLength', () => {
      expect(truncateText('short', 10)).toBe('short')
    })
    it('truncates with ellipsis', () => {
      const long = 'a'.repeat(110)
      expect(truncateText(long, 100).length).toBe(100)
      expect(truncateText(long, 100)).toMatch(/\.\.\.$/)
    })
    it('uses default maxLength 100', () => {
      const long = 'x'.repeat(150)
      expect(truncateText(long).length).toBe(100)
    })
  })

  describe('formatSeverity', () => {
    it('capitalizes first letter and lowercases rest', () => {
      expect(formatSeverity('error')).toBe('Error')
      expect(formatSeverity('WARNING')).toBe('Warning')
    })
  })
})
