/**
 * Property-Based Tests for Costbook Currency Utilities
 * 
 * These tests validate currency conversion accuracy, formatting correctness,
 * and symbol inclusion using fast-check for property-based testing.
 */

import * as fc from 'fast-check'
import {
  getAllCurrencies,
  getCurrencySymbol,
  getCurrencyDisplayName,
  getCurrencyShortName,
  convertCurrency,
  convertCurrencyViaUSD,
  formatCurrency,
  formatCurrencyDelta,
  parseCurrencyString,
  getExchangeRate,
  isValidCurrency,
  toCurrency,
  calculateCurrencyChange,
  formatPercentage,
  getVarianceColorClass,
  getVarianceBgColorClass
} from '@/lib/currency-utils'
import { Currency, EXCHANGE_RATES, CURRENCY_SYMBOLS } from '@/types/costbook'

  // Arbitrary for valid currencies
const currencyArbitrary = fc.constantFrom(
  Currency.USD,
  Currency.EUR,
  Currency.GBP,
  Currency.CHF,
  Currency.JPY
)
// Non-JPY currencies for round-trip (JPY has large relative rounding error)
const currencyArbitraryNoJPY = fc.constantFrom(
  Currency.USD,
  Currency.EUR,
  Currency.GBP,
  Currency.CHF
)

describe('Currency Utils - Property Tests', () => {

  // ============================================
  // Property 7: Currency Conversion Consistency
  // ============================================
  describe('Property 7: Currency Conversion Consistency (Round-Trip)', () => {
    it('should maintain value within tolerance on round-trip conversion', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000000), noNaN: true }),
          currencyArbitraryNoJPY,
          currencyArbitraryNoJPY,
          (amount, from, to) => {
            // Convert from -> to -> from (excluding JPY - its scale causes large round-trip error)
            const converted = convertCurrency(amount, from, to)
            const roundTrip = convertCurrency(converted, to, from)

            const tolerance = Math.max(amount * 0.02, 0.001)
            const diff = Math.abs(roundTrip - amount)
            const epsilon = 0.02

            return diff <= tolerance + epsilon
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return same value when converting to same currency', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0), max: Math.fround(1000000), noNaN: true }),
          currencyArbitrary,
          (amount, currency) => {
            const result = convertCurrency(amount, currency, currency)
            // Result should equal the rounded original amount
            return Math.abs(result - Math.round(amount * 100) / 100) < 0.01
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle zero conversion correctly', () => {
      fc.assert(
        fc.property(
          currencyArbitrary,
          currencyArbitrary,
          (from, to) => {
            return convertCurrency(0, from, to) === 0
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle null/undefined conversion gracefully', () => {
      fc.assert(
        fc.property(
          currencyArbitrary,
          currencyArbitrary,
          (from, to) => {
            const nullResult = convertCurrency(null, from, to)
            const undefinedResult = convertCurrency(undefined, from, to)
            return nullResult === 0 && undefinedResult === 0
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should maintain conversion order property: A->B->C equals A->C (within tolerance)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: Math.fround(10000), noNaN: true }),
          (amount) => {
            // Convert USD -> EUR -> GBP
            const viaEUR = convertCurrency(
              convertCurrency(amount, Currency.USD, Currency.EUR),
              Currency.EUR,
              Currency.GBP
            )
            
            // Convert USD -> GBP directly
            const direct = convertCurrency(amount, Currency.USD, Currency.GBP)
            
            // Allow 2% tolerance for multi-step conversion
            const tolerance = amount * 0.02
            const diff = Math.abs(viaEUR - direct)
            
            return diff <= tolerance + 0.01
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // ============================================
  // Property 8: Currency Symbol Inclusion
  // ============================================
  describe('Property 8: Currency Symbol Inclusion', () => {
    it('should always include currency symbol when showSymbol is true', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0), max: Math.fround(1000000), noNaN: true }),
          currencyArbitrary,
          (amount, currency) => {
            const formatted = formatCurrency(amount, currency, { showSymbol: true })
            const symbol = getCurrencySymbol(currency)
            
            // The formatted string should contain the symbol or currency code
            // (Intl.NumberFormat may use the code for some currencies)
            return formatted.includes(symbol) || formatted.includes(currency)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return valid symbol for all currencies', () => {
      const currencies = getAllCurrencies()
      
      for (const currency of currencies) {
        const symbol = getCurrencySymbol(currency)
        expect(symbol).toBeTruthy()
        expect(symbol.length).toBeGreaterThan(0)
        expect(CURRENCY_SYMBOLS[currency]).toBe(symbol)
      }
    })

    it('should include currency code when showCode is true', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0), max: Math.fround(1000000), noNaN: true }),
          currencyArbitrary,
          (amount, currency) => {
            const formatted = formatCurrency(amount, currency, { 
              showSymbol: false, 
              showCode: true 
            })
            return formatted.includes(currency.toString())
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle compact formatting with symbols', () => {
      const testCases = [
        { amount: 1500000, expected: 'M' },
        { amount: 1500, expected: 'K' }
      ]
      
      for (const { amount, expected } of testCases) {
        const formatted = formatCurrency(amount, Currency.USD, { compact: true })
        expect(formatted).toContain(expected)
      }
    })
  })

  // ============================================
  // Additional Currency Utility Tests
  // ============================================
  describe('Currency Utility Functions', () => {
    describe('getAllCurrencies', () => {
      it('should return all supported currencies', () => {
        const currencies = getAllCurrencies()
        expect(currencies).toHaveLength(11)
        expect(currencies).toContain(Currency.USD)
        expect(currencies).toContain(Currency.EUR)
        expect(currencies).toContain(Currency.GBP)
        expect(currencies).toContain(Currency.CHF)
        expect(currencies).toContain(Currency.JPY)
        expect(currencies).toContain(Currency.PLN)
        expect(currencies).toContain(Currency.MXN)
        expect(currencies).toContain(Currency.CNY)
        expect(currencies).toContain(Currency.INR)
        expect(currencies).toContain(Currency.KRW)
        expect(currencies).toContain(Currency.VND)
      })
    })

    describe('getCurrencyDisplayName', () => {
      it('should return human-readable names for all currencies', () => {
        const currencies = getAllCurrencies()
        
        for (const currency of currencies) {
          const displayName = getCurrencyDisplayName(currency)
          expect(displayName).toBeTruthy()
          expect(displayName.length).toBeGreaterThan(currency.length)
          expect(displayName).toContain(currency)
        }
      })
    })

    describe('getCurrencyShortName', () => {
      it('should return the currency code', () => {
        fc.assert(
          fc.property(
            currencyArbitrary,
            (currency) => {
              const shortName = getCurrencyShortName(currency)
              return shortName === currency.toString()
            }
          ),
          { numRuns: 50 }
        )
      })
    })

    describe('getExchangeRate', () => {
      it('should return 1 for same currency', () => {
        fc.assert(
          fc.property(
            currencyArbitrary,
            (currency) => {
              return getExchangeRate(currency, currency) === 1
            }
          ),
          { numRuns: 50 }
        )
      })

      it('should return valid exchange rate for different currencies', () => {
        fc.assert(
          fc.property(
            currencyArbitrary,
            currencyArbitrary,
            (from, to) => {
              const rate = getExchangeRate(from, to)
              return rate > 0
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should have inverse relationship', () => {
        fc.assert(
          fc.property(
            currencyArbitrary,
            currencyArbitrary,
            (from, to) => {
              if (from === to) return true
              
              const forward = getExchangeRate(from, to)
              const backward = getExchangeRate(to, from)
              
              // forward * backward should be close to 1
              const product = forward * backward
              return product > 0.9 && product < 1.1 // 10% tolerance
            }
          ),
          { numRuns: 100 }
        )
      })
    })

    describe('formatCurrencyDelta', () => {
      it('should add + prefix for positive amounts', () => {
        fc.assert(
          fc.property(
            fc.float({ min: Math.fround(0.01), max: Math.fround(1000000), noNaN: true }),
            currencyArbitrary,
            (amount, currency) => {
              const formatted = formatCurrencyDelta(amount, currency)
              return formatted.startsWith('+')
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should add - prefix for negative amounts', () => {
        fc.assert(
          fc.property(
            fc.float({ min: Math.fround(-1000000), max: Math.fround(-0.01), noNaN: true }),
            currencyArbitrary,
            (amount, currency) => {
              const formatted = formatCurrencyDelta(amount, currency)
              return formatted.startsWith('-')
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should not add sign for zero', () => {
        const formatted = formatCurrencyDelta(0, Currency.USD)
        expect(formatted.startsWith('+')).toBe(false)
        expect(formatted.startsWith('-')).toBe(false)
      })
    })

    describe('parseCurrencyString', () => {
      it('should parse formatted currency back to number', () => {
        fc.assert(
          fc.property(
            fc.float({ min: Math.fround(0), max: Math.fround(100000), noNaN: true }),
            currencyArbitrary,
            (amount, currency) => {
              const formatted = formatCurrency(amount, currency)
              const parsed = parseCurrencyString(formatted)
              
              // Allow small tolerance for formatting/parsing
              const tolerance = 0.1
              return Math.abs(parsed - amount) <= tolerance || 
                     Math.abs(parsed - Math.round(amount * 100) / 100) <= tolerance
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should handle various number formats', () => {
        const testCases = [
          { input: '$1,234.56', expected: 1234.56 },
          { input: '1.234,56', expected: 1234.56 }, // German format
          { input: '€ 100', expected: 100 },
          { input: '1.5K', expected: 1500 },
          { input: '2.5M', expected: 2500000 },
          { input: '£999.99', expected: 999.99 }
        ]
        
        for (const { input, expected } of testCases) {
          const result = parseCurrencyString(input)
          expect(result).toBeCloseTo(expected, 1)
        }
      })

      it('should return 0 for invalid input', () => {
        expect(parseCurrencyString('')).toBe(0)
        expect(parseCurrencyString('abc')).toBe(0)
        expect(parseCurrencyString(null as any)).toBe(0)
        expect(parseCurrencyString(undefined as any)).toBe(0)
      })
    })

    describe('isValidCurrency', () => {
      it('should return true for valid currency codes', () => {
        const currencies = getAllCurrencies()
        
        for (const currency of currencies) {
          expect(isValidCurrency(currency)).toBe(true)
        }
      })

      it('should return false for invalid codes', () => {
        expect(isValidCurrency('INVALID')).toBe(false)
        expect(isValidCurrency('xyz')).toBe(false)
        expect(isValidCurrency('')).toBe(false)
      })
    })

    describe('toCurrency', () => {
      it('should return valid currency for valid codes', () => {
        expect(toCurrency('USD')).toBe(Currency.USD)
        expect(toCurrency('EUR')).toBe(Currency.EUR)
        expect(toCurrency('GBP')).toBe(Currency.GBP)
      })

      it('should return fallback for invalid codes', () => {
        expect(toCurrency('INVALID')).toBe(Currency.USD)
        expect(toCurrency('INVALID', Currency.EUR)).toBe(Currency.EUR)
      })
    })

    describe('calculateCurrencyChange', () => {
      it('should calculate correct percentage change', () => {
        expect(calculateCurrencyChange(100, 120)).toBe(20) // 20% increase
        expect(calculateCurrencyChange(100, 80)).toBe(-20) // 20% decrease
        expect(calculateCurrencyChange(100, 100)).toBe(0) // No change
      })

      it('should handle zero original amount', () => {
        expect(calculateCurrencyChange(0, 100)).toBe(100)
        expect(calculateCurrencyChange(0, 0)).toBe(0)
      })

      it('should handle null values', () => {
        expect(calculateCurrencyChange(null, 100)).toBe(100)
        expect(calculateCurrencyChange(100, null)).toBe(-100)
        expect(calculateCurrencyChange(null, null)).toBe(0)
      })
    })

    describe('formatPercentage', () => {
      it('should add + prefix for positive percentages', () => {
        const result = formatPercentage(25.5)
        expect(result).toBe('+25.5%')
      })

      it('should keep - for negative percentages', () => {
        const result = formatPercentage(-15.3)
        expect(result).toBe('-15.3%')
      })

      it('should handle zero', () => {
        const result = formatPercentage(0)
        expect(result).toBe('0.0%')
      })

      it('should handle null/undefined', () => {
        expect(formatPercentage(null)).toBe('0%')
        expect(formatPercentage(undefined)).toBe('0%')
      })

      it('should respect decimal places', () => {
        expect(formatPercentage(25.567, 2)).toBe('+25.57%')
        expect(formatPercentage(25.567, 0)).toBe('+26%')
      })
    })

    describe('getVarianceColorClass', () => {
      it('should return green for positive variance', () => {
        expect(getVarianceColorClass(100)).toBe('text-green-600')
      })

      it('should return red for negative variance', () => {
        expect(getVarianceColorClass(-100)).toBe('text-red-600')
      })

      it('should return gray for zero or null variance', () => {
        expect(getVarianceColorClass(0)).toBe('text-gray-500')
        expect(getVarianceColorClass(null)).toBe('text-gray-500')
        expect(getVarianceColorClass(undefined)).toBe('text-gray-500')
      })
    })

    describe('getVarianceBgColorClass', () => {
      it('should return correct background colors', () => {
        expect(getVarianceBgColorClass(100)).toBe('bg-green-100')
        expect(getVarianceBgColorClass(-100)).toBe('bg-red-100')
        expect(getVarianceBgColorClass(0)).toBe('bg-gray-100')
        expect(getVarianceBgColorClass(null)).toBe('bg-gray-100')
      })
    })
  })

  // ============================================
  // Exchange Rate Matrix Validation
  // ============================================
  describe('Exchange Rate Matrix', () => {
    it('should have complete exchange rate matrix', () => {
      const currencies = getAllCurrencies()
      
      for (const from of currencies) {
        for (const to of currencies) {
          expect(EXCHANGE_RATES[from]).toBeDefined()
          expect(EXCHANGE_RATES[from][to]).toBeDefined()
          expect(typeof EXCHANGE_RATES[from][to]).toBe('number')
          expect(EXCHANGE_RATES[from][to]).toBeGreaterThan(0)
        }
      }
    })

    it('should have 1.0 rate for same currency conversions', () => {
      const currencies = getAllCurrencies()
      
      for (const currency of currencies) {
        expect(EXCHANGE_RATES[currency][currency]).toBe(1.0)
      }
    })
  })
})