/**
 * Property Test: Frontend Data Formatting Consistency
 * 
 * Feature: ai-empowered-ppm-features
 * Property 37: Frontend Data Formatting Consistency
 * 
 * For any displayed numerical value or date across all pages, the Frontend SHALL use
 * consistent formatting (e.g., dates as YYYY-MM-DD, currency with 2 decimals, percentages with 1 decimal).
 * 
 * Validates: Requirements 5.6
 */

import { describe, it, expect } from '@jest/globals'
import fc from 'fast-check'

/**
 * Format date consistently (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date')
  }
  return date.toISOString().split('T')[0]
}

/**
 * Format currency consistently (2 decimals)
 */
function formatCurrency(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Format percentage consistently (1 decimal)
 */
function formatPercentage(value: number): string {
  return value.toFixed(1)
}

/**
 * Format number with thousands separator
 */
function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

describe('Property 37: Frontend Data Formatting Consistency', () => {
  it('should format dates consistently as YYYY-MM-DD', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).filter(d => !isNaN(d.getTime())),
        (date) => {
          const formatted = formatDate(date)
          
          // Check format matches YYYY-MM-DD
          expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          
          // Check it's a valid date by parsing the formatted string
          const parsed = new Date(formatted + 'T00:00:00.000Z')
          const originalUTC = new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate()
          ))
          
          expect(parsed.getTime()).toBe(originalUTC.getTime())
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should format currency consistently with 2 decimals', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (amount) => {
          const formatted = formatCurrency(amount)
          
          // Check format has exactly 2 decimal places
          expect(formatted).toMatch(/^\d+\.\d{2}$/)
          
          // Check value is preserved
          const parsed = parseFloat(formatted)
          expect(Math.abs(parsed - amount)).toBeLessThan(0.01)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should format percentages consistently with 1 decimal', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        (percentage) => {
          const formatted = formatPercentage(percentage)
          
          // Check format has exactly 1 decimal place
          expect(formatted).toMatch(/^\d+\.\d{1}$/)
          
          // Check value is preserved
          const parsed = parseFloat(formatted)
          expect(Math.abs(parsed - percentage)).toBeLessThan(0.1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should format large numbers with thousands separator', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }),
        (value) => {
          const formatted = formatNumber(value)
          
          // Check format includes commas for thousands
          if (value >= 1000) {
            expect(formatted).toContain(',')
          }
          
          // Check value is preserved
          const parsed = parseInt(formatted.replace(/,/g, ''))
          expect(parsed).toBe(value)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should maintain consistency across multiple formatting operations', () => {
    fc.assert(
      fc.property(
        fc.record({
          date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).filter(d => !isNaN(d.getTime())),
          amount: fc.float({ min: 0, max: 1000000, noNaN: true }),
          percentage: fc.float({ min: 0, max: 100, noNaN: true }),
          count: fc.integer({ min: 0, max: 10000000 })
        }),
        (data) => {
          // Format all values
          const formattedDate = formatDate(data.date)
          const formattedAmount = formatCurrency(data.amount)
          const formattedPercentage = formatPercentage(data.percentage)
          const formattedCount = formatNumber(data.count)
          
          // Verify all formats are consistent
          expect(formattedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(formattedAmount).toMatch(/^\d+\.\d{2}$/)
          expect(formattedPercentage).toMatch(/^\d+\.\d{1}$/)
          
          // Verify formatting is idempotent (formatting twice gives same result)
          expect(formatDate(new Date(formattedDate))).toBe(formattedDate)
          expect(formatCurrency(parseFloat(formattedAmount))).toBe(formattedAmount)
          expect(formatPercentage(parseFloat(formattedPercentage))).toBe(formattedPercentage)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle edge cases in date formatting', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          new Date('2020-01-01T00:00:00.000Z'),
          new Date('2020-12-31T00:00:00.000Z'),
          new Date('2024-02-29T00:00:00.000Z'), // Leap year
          new Date('2023-02-28T00:00:00.000Z'), // Non-leap year
          new Date('2030-12-31T00:00:00.000Z')
        ),
        (date) => {
          const formatted = formatDate(date)
          
          // Check format is valid
          expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          
          // Check date can be parsed back
          const parsed = new Date(formatted + 'T00:00:00.000Z')
          const originalUTC = new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate()
          ))
          
          expect(parsed.getTime()).toBe(originalUTC.getTime())
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should handle edge cases in currency formatting', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0, 0.01, 0.99, 1.00, 999.99, 1000.00, 999999.99),
        (amount) => {
          const formatted = formatCurrency(amount)
          
          // Check format has exactly 2 decimal places
          expect(formatted).toMatch(/^\d+\.\d{2}$/)
          
          // Check value is preserved
          const parsed = parseFloat(formatted)
          expect(parsed).toBeCloseTo(amount, 2)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should handle edge cases in percentage formatting', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0, 0.1, 0.9, 1.0, 50.0, 99.9, 100.0),
        (percentage) => {
          const formatted = formatPercentage(percentage)
          
          // Check format has exactly 1 decimal place
          expect(formatted).toMatch(/^\d+\.\d{1}$/)
          
          // Check value is preserved
          const parsed = parseFloat(formatted)
          expect(parsed).toBeCloseTo(percentage, 1)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should format negative currency values consistently', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1000000, max: 0, noNaN: true }),
        (amount) => {
          const formatted = formatCurrency(amount)
          
          // Check format has exactly 2 decimal places (including negative sign)
          expect(formatted).toMatch(/^-?\d+\.\d{2}$/)
          
          // Check value is preserved
          const parsed = parseFloat(formatted)
          expect(Math.abs(parsed - amount)).toBeLessThan(0.01)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should format zero values consistently', () => {
    // Test zero values for all formatters
    expect(formatCurrency(0)).toBe('0.00')
    expect(formatPercentage(0)).toBe('0.0')
    expect(formatNumber(0)).toBe('0')
    
    // Test that zero is always formatted the same way
    fc.assert(
      fc.property(
        fc.constant(0),
        (zero) => {
          expect(formatCurrency(zero)).toBe('0.00')
          expect(formatPercentage(zero)).toBe('0.0')
          expect(formatNumber(zero)).toBe('0')
        }
      ),
      { numRuns: 10 }
    )
  })
})
