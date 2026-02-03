/**
 * Unit tests for lib/currency-utils.ts
 * Covers formatting, parsing, conversion, and variance helpers.
 */

import {
  getAllCurrencies,
  getCurrencyDisplayName,
  getCurrencyShortName,
  getCurrencySymbol,
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
} from '../currency-utils'
import { Currency } from '@/types/costbook'

describe('currency-utils', () => {
  describe('getAllCurrencies', () => {
    it('returns all Currency enum values', () => {
      const list = getAllCurrencies()
      expect(list).toContain(Currency.USD)
      expect(list).toContain(Currency.EUR)
      expect(list).toContain(Currency.GBP)
      expect(list).toContain(Currency.CHF)
      expect(list).toContain(Currency.JPY)
      expect(list).toHaveLength(5)
    })
  })

  describe('getCurrencyDisplayName', () => {
    it('returns display name for each currency', () => {
      expect(getCurrencyDisplayName(Currency.USD)).toBe('US Dollar (USD)')
      expect(getCurrencyDisplayName(Currency.EUR)).toBe('Euro (EUR)')
      expect(getCurrencyDisplayName(Currency.GBP)).toBe('British Pound (GBP)')
    })
    it('returns currency string for unknown', () => {
      expect(getCurrencyDisplayName('XXX' as Currency)).toBe('XXX')
    })
  })

  describe('getCurrencyShortName', () => {
    it('returns currency code', () => {
      expect(getCurrencyShortName(Currency.USD)).toBe('USD')
      expect(getCurrencyShortName(Currency.JPY)).toBe('JPY')
    })
  })

  describe('getCurrencySymbol', () => {
    it('returns symbol for known currency', () => {
      expect(getCurrencySymbol(Currency.USD)).toBe('$')
      expect(getCurrencySymbol(Currency.EUR)).toBe('€')
      expect(getCurrencySymbol(Currency.GBP)).toBe('£')
      expect(getCurrencySymbol(Currency.CHF)).toBe('CHF')
      expect(getCurrencySymbol(Currency.JPY)).toBe('¥')
    })
    it('returns code for unknown', () => {
      expect(getCurrencySymbol('XXX' as Currency)).toBe('XXX')
    })
  })

  describe('convertCurrency', () => {
    it('returns 0 for null/undefined/NaN', () => {
      expect(convertCurrency(null, Currency.USD, Currency.EUR)).toBe(0)
      expect(convertCurrency(undefined, Currency.USD, Currency.EUR)).toBe(0)
      expect(convertCurrency(NaN, Currency.USD, Currency.EUR)).toBe(0)
    })
    it('returns same amount when from === to', () => {
      expect(convertCurrency(100, Currency.USD, Currency.USD)).toBe(100)
    })
    it('converts using exchange rate', () => {
      const result = convertCurrency(100, Currency.USD, Currency.EUR)
      expect(result).toBe(85) // 100 * 0.85
    })
    it('falls back to amount when rate not found (with warn)', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation()
      const result = convertCurrency(100, 'XXX' as Currency, Currency.EUR)
      expect(result).toBe(100)
      spy.mockRestore()
    })
  })

  describe('convertCurrencyViaUSD', () => {
    it('returns 0 for null/undefined/NaN', () => {
      expect(convertCurrencyViaUSD(null, Currency.USD, Currency.EUR)).toBe(0)
      expect(convertCurrencyViaUSD(undefined, Currency.EUR, Currency.GBP)).toBe(0)
    })
    it('returns same amount when from === to', () => {
      expect(convertCurrencyViaUSD(50, Currency.GBP, Currency.GBP)).toBe(50)
    })
    it('converts via USD', () => {
      const result = convertCurrencyViaUSD(100, Currency.EUR, Currency.GBP)
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('formatCurrency', () => {
    it('formats null/undefined/NaN as zero with symbol', () => {
      expect(formatCurrency(null, Currency.USD)).toMatch(/\$0\.00/)
      expect(formatCurrency(undefined, Currency.EUR)).toMatch(/0\.00/)
      expect(formatCurrency(NaN, Currency.GBP)).toMatch(/0\.00/)
    })
    it('respects showSymbol false', () => {
      const s = formatCurrency(100, Currency.USD, { showSymbol: false })
      expect(s).not.toContain('$')
      expect(s).toContain('100')
    })
    it('respects showCode', () => {
      const s = formatCurrency(100, Currency.USD, { showCode: true, locale: 'en-US' })
      expect(s).toContain('100')
      expect(s).toMatch(/USD|\$/)
    })
    it('uses compact for large numbers (M)', () => {
      const s = formatCurrency(2_500_000, Currency.USD, { compact: true })
      expect(s).toMatch(/2\.5M/)
    })
    it('uses compact for thousands (K)', () => {
      const s = formatCurrency(5000, Currency.EUR, { compact: true })
      expect(s).toMatch(/5\.0K/)
    })
    it('formats normal amount with Intl', () => {
      const s = formatCurrency(1234.56, Currency.USD)
      expect(s).toContain('1')
      expect(s).toContain('234')
      expect(s).toContain('56')
    })
    it('respects decimals option', () => {
      const s = formatCurrency(100.123, Currency.USD, { decimals: 0 })
      expect(s).toMatch(/100/)
    })
  })

  describe('formatCurrencyDelta', () => {
    it('formats null/undefined/NaN as zero', () => {
      expect(formatCurrencyDelta(null, Currency.USD)).not.toContain('+')
      expect(formatCurrencyDelta(undefined, Currency.EUR)).not.toContain('-')
    })
    it('prepends + for positive', () => {
      expect(formatCurrencyDelta(100, Currency.USD)).toMatch(/^\+/)
    })
    it('prepends - for negative', () => {
      expect(formatCurrencyDelta(-50, Currency.EUR)).toMatch(/^-/)
    })
    it('no sign for zero', () => {
      const s = formatCurrencyDelta(0, Currency.GBP)
      expect(s).not.toMatch(/^\+/)
      expect(s).not.toMatch(/^-/)
    })
  })

  describe('parseCurrencyString', () => {
    it('returns 0 for empty or non-string', () => {
      expect(parseCurrencyString('')).toBe(0)
      expect(parseCurrencyString(null as any)).toBe(0)
      expect(parseCurrencyString(undefined as any)).toBe(0)
    })
    it('strips symbols and parses number', () => {
      expect(parseCurrencyString('$1,234.56')).toBe(1234.56)
      expect(parseCurrencyString('€ 100')).toBe(100)
    })
    it('handles German format (1.234,56)', () => {
      expect(parseCurrencyString('1.234,56')).toBe(1234.56)
    })
    it('handles K suffix', () => {
      expect(parseCurrencyString('5K')).toBe(5000)
      expect(parseCurrencyString('5k')).toBe(5000)
    })
    it('handles M suffix', () => {
      expect(parseCurrencyString('2M')).toBe(2000000)
      expect(parseCurrencyString('1.5m')).toBe(1500000)
    })
    it('returns 0 for invalid', () => {
      expect(parseCurrencyString('abc')).toBe(0)
    })
  })

  describe('getExchangeRate', () => {
    it('returns 1 for same currency', () => {
      expect(getExchangeRate(Currency.USD, Currency.USD)).toBe(1)
    })
    it('returns rate for pair', () => {
      expect(getExchangeRate(Currency.USD, Currency.EUR)).toBe(0.85)
    })
    it('returns 1 when not found', () => {
      expect(getExchangeRate('XXX' as Currency, Currency.EUR)).toBe(1)
    })
  })

  describe('isValidCurrency', () => {
    it('returns true for enum values', () => {
      expect(isValidCurrency('USD')).toBe(true)
      expect(isValidCurrency('EUR')).toBe(true)
    })
    it('returns false for invalid', () => {
      expect(isValidCurrency('XXX')).toBe(false)
      expect(isValidCurrency('')).toBe(false)
    })
  })

  describe('toCurrency', () => {
    it('returns code if valid', () => {
      expect(toCurrency('USD')).toBe(Currency.USD)
      expect(toCurrency('EUR')).toBe(Currency.EUR)
    })
    it('returns fallback if invalid', () => {
      expect(toCurrency('XXX')).toBe(Currency.USD)
      expect(toCurrency('BAD', Currency.EUR)).toBe(Currency.EUR)
    })
  })

  describe('calculateCurrencyChange', () => {
    it('returns 0 when both 0', () => {
      expect(calculateCurrencyChange(0, 0)).toBe(0)
    })
    it('returns 100 when original 0 and new non-zero', () => {
      expect(calculateCurrencyChange(0, 50)).toBe(100)
    })
    it('calculates percentage change', () => {
      expect(calculateCurrencyChange(100, 120)).toBe(20)
      expect(calculateCurrencyChange(100, 80)).toBe(-20)
    })
    it('handles null/undefined as 0', () => {
      expect(calculateCurrencyChange(null, 100)).toBe(100)
      expect(calculateCurrencyChange(100, undefined)).toBe(-100)
    })
  })

  describe('formatPercentage', () => {
    it('returns 0% for null/undefined/NaN', () => {
      expect(formatPercentage(null)).toBe('0%')
      expect(formatPercentage(undefined)).toBe('0%')
      expect(formatPercentage(NaN)).toBe('0%')
    })
    it('prepends + for positive', () => {
      expect(formatPercentage(5.5)).toMatch(/^\+/)
      expect(formatPercentage(5.5)).toContain('%')
    })
    it('no + for zero or negative', () => {
      expect(formatPercentage(0)).not.toMatch(/^\+/)
      expect(formatPercentage(-1)).not.toMatch(/^\+/)
    })
    it('respects decimals', () => {
      expect(formatPercentage(1.234, 2)).toContain('1.23')
    })
  })

  describe('getVarianceColorClass', () => {
    it('returns gray for null/undefined', () => {
      expect(getVarianceColorClass(null)).toBe('text-gray-500')
      expect(getVarianceColorClass(undefined)).toBe('text-gray-500')
    })
    it('returns green for positive', () => {
      expect(getVarianceColorClass(1)).toBe('text-green-600')
    })
    it('returns red for negative', () => {
      expect(getVarianceColorClass(-1)).toBe('text-red-600')
    })
    it('returns gray for zero', () => {
      expect(getVarianceColorClass(0)).toBe('text-gray-500')
    })
  })

  describe('getVarianceBgColorClass', () => {
    it('returns gray bg for null/undefined', () => {
      expect(getVarianceBgColorClass(null)).toBe('bg-gray-100')
      expect(getVarianceBgColorClass(undefined)).toBe('bg-gray-100')
    })
    it('returns green bg for positive', () => {
      expect(getVarianceBgColorClass(1)).toBe('bg-green-100')
    })
    it('returns red bg for negative', () => {
      expect(getVarianceBgColorClass(-1)).toBe('bg-red-100')
    })
    it('returns gray bg for zero', () => {
      expect(getVarianceBgColorClass(0)).toBe('bg-gray-100')
    })
  })
})
