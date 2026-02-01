// Costbook Currency Conversion and Formatting Utilities
// Phase 1: Hardcoded exchange rates for initial implementation

import { Currency, EXCHANGE_RATES, CURRENCY_SYMBOLS } from '@/types/costbook'
import { roundToDecimal } from './costbook-calculations'

/**
 * Gets all available currencies
 * @returns Array of all Currency enum values
 */
export function getAllCurrencies(): Currency[] {
  return Object.values(Currency)
}

/**
 * Gets the display name for a currency
 * @param currency - Currency enum value
 * @returns Human-readable currency name
 */
export function getCurrencyDisplayName(currency: Currency): string {
  const displayNames: Record<Currency, string> = {
    [Currency.USD]: 'US Dollar (USD)',
    [Currency.EUR]: 'Euro (EUR)',
    [Currency.GBP]: 'British Pound (GBP)',
    [Currency.CHF]: 'Swiss Franc (CHF)',
    [Currency.JPY]: 'Japanese Yen (JPY)'
  }
  return displayNames[currency] || currency
}

/**
 * Gets the short display name for a currency
 * @param currency - Currency enum value
 * @returns Short currency name (e.g., "USD")
 */
export function getCurrencyShortName(currency: Currency): string {
  return currency.toString()
}

/**
 * Gets the symbol for a currency
 * @param currency - Currency enum value
 * @returns Currency symbol (e.g., "$", "€", "£")
 */
export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOLS[currency] || currency.toString()
}

/**
 * Converts an amount from one currency to another
 * Uses hardcoded exchange rates for Phase 1
 * 
 * @param amount - Amount to convert
 * @param from - Source currency
 * @param to - Target currency
 * @returns Converted amount rounded to 2 decimal places
 */
export function convertCurrency(
  amount: number | null | undefined,
  from: Currency,
  to: Currency
): number {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 0
  }

  // Same currency, no conversion needed
  if (from === to) {
    return roundToDecimal(amount)
  }

  // Get exchange rate
  const rate = EXCHANGE_RATES[from]?.[to]
  
  if (rate === undefined) {
    console.warn(`Exchange rate not found for ${from} to ${to}`)
    return roundToDecimal(amount)
  }

  return roundToDecimal(amount * rate)
}

/**
 * Converts an amount through USD as an intermediary
 * Useful for currencies without direct exchange rates
 * 
 * @param amount - Amount to convert
 * @param from - Source currency
 * @param to - Target currency
 * @returns Converted amount rounded to 2 decimal places
 */
export function convertCurrencyViaUSD(
  amount: number | null | undefined,
  from: Currency,
  to: Currency
): number {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 0
  }

  if (from === to) {
    return roundToDecimal(amount)
  }

  // Convert to USD first, then to target currency
  const toUSD = EXCHANGE_RATES[from]?.[Currency.USD] || 1
  const fromUSD = EXCHANGE_RATES[Currency.USD]?.[to] || 1
  
  return roundToDecimal(amount * toUSD * fromUSD)
}

/**
 * Formats a number as currency with proper symbol placement
 * 
 * @param amount - Amount to format
 * @param currency - Currency for formatting
 * @param options - Optional formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: Currency,
  options?: {
    showSymbol?: boolean
    showCode?: boolean
    decimals?: number
    locale?: string
    compact?: boolean
  }
): string {
  const {
    showSymbol = true,
    showCode = false,
    decimals = 2,
    locale = 'de-DE',
    compact = false
  } = options || {}

  // Handle null/undefined
  if (amount === null || amount === undefined || isNaN(amount)) {
    const symbol = showSymbol ? getCurrencySymbol(currency) : ''
    const code = showCode ? ` ${currency}` : ''
    return `${symbol}0.00${code}`
  }

  // Handle compact formatting for large numbers
  if (compact && Math.abs(amount) >= 1000000) {
    const millions = amount / 1000000
    const formatted = millions.toFixed(1)
    const symbol = showSymbol ? getCurrencySymbol(currency) : ''
    const code = showCode ? ` ${currency}` : ''
    return `${symbol}${formatted}M${code}`
  }

  if (compact && Math.abs(amount) >= 1000) {
    const thousands = amount / 1000
    const formatted = thousands.toFixed(1)
    const symbol = showSymbol ? getCurrencySymbol(currency) : ''
    const code = showCode ? ` ${currency}` : ''
    return `${symbol}${formatted}K${code}`
  }

  // Use Intl.NumberFormat for proper localization
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: showSymbol ? 'currency' : 'decimal',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })

    const formatted = formatter.format(amount)
    
    if (showCode && !showSymbol) {
      return `${formatted} ${currency}`
    }
    
    return formatted
  } catch {
    // Fallback for environments without Intl support
    const symbol = showSymbol ? getCurrencySymbol(currency) : ''
    const formattedAmount = amount.toFixed(decimals)
    const code = showCode ? ` ${currency}` : ''
    return `${symbol}${formattedAmount}${code}`
  }
}

/**
 * Formats a currency amount as a delta (with + or - prefix)
 * 
 * @param amount - Amount to format (positive for gain, negative for loss)
 * @param currency - Currency for formatting
 * @returns Formatted string with sign prefix
 */
export function formatCurrencyDelta(
  amount: number | null | undefined,
  currency: Currency
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return formatCurrency(0, currency)
  }

  const formatted = formatCurrency(Math.abs(amount), currency)
  
  if (amount > 0) {
    return `+${formatted}`
  } else if (amount < 0) {
    return `-${formatted}`
  }
  
  return formatted
}

/**
 * Parses a currency string back to a number
 * Handles various currency formats
 * 
 * @param value - String value to parse
 * @returns Parsed number or 0 if parsing fails
 */
export function parseCurrencyString(value: string): number {
  if (!value || typeof value !== 'string') {
    return 0
  }

  // Remove currency symbols and whitespace
  let cleaned = value
    .replace(/[$€£¥CHF]/gi, '')
    .replace(/\s/g, '')
    .trim()

  // Handle German number format (1.234,56)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Determine which is the decimal separator
    const lastDot = cleaned.lastIndexOf('.')
    const lastComma = cleaned.lastIndexOf(',')
    
    if (lastComma > lastDot) {
      // German format: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // US format: 1,234.56
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    // Could be German decimal (1234,56) or US thousands (1,234)
    // Assume German if comma is near end
    if (cleaned.indexOf(',') >= cleaned.length - 3) {
      cleaned = cleaned.replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }

  // Handle K and M suffixes
  if (cleaned.endsWith('K') || cleaned.endsWith('k')) {
    cleaned = cleaned.slice(0, -1)
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num * 1000
  }
  
  if (cleaned.endsWith('M') || cleaned.endsWith('m')) {
    cleaned = cleaned.slice(0, -1)
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num * 1000000
  }

  const result = parseFloat(cleaned)
  return isNaN(result) ? 0 : result
}

/**
 * Gets the exchange rate between two currencies
 * 
 * @param from - Source currency
 * @param to - Target currency
 * @returns Exchange rate or 1 if not found
 */
export function getExchangeRate(from: Currency, to: Currency): number {
  if (from === to) {
    return 1
  }
  
  return EXCHANGE_RATES[from]?.[to] || 1
}

/**
 * Validates if a currency code is valid
 * 
 * @param code - Currency code to validate
 * @returns True if valid currency
 */
export function isValidCurrency(code: string): code is Currency {
  return Object.values(Currency).includes(code as Currency)
}

/**
 * Converts a currency code string to Currency enum
 * 
 * @param code - Currency code string
 * @param fallback - Fallback currency if code is invalid
 * @returns Currency enum value
 */
export function toCurrency(code: string, fallback: Currency = Currency.USD): Currency {
  if (isValidCurrency(code)) {
    return code
  }
  return fallback
}

/**
 * Calculates the percentage change between two currency amounts
 * 
 * @param originalAmount - Original amount
 * @param newAmount - New amount
 * @returns Percentage change (positive for increase, negative for decrease)
 */
export function calculateCurrencyChange(
  originalAmount: number | null | undefined,
  newAmount: number | null | undefined
): number {
  const original = originalAmount ?? 0
  const current = newAmount ?? 0

  if (original === 0) {
    return current === 0 ? 0 : 100
  }

  return roundToDecimal(((current - original) / original) * 100)
}

/**
 * Formats a percentage with proper sign and suffix
 * 
 * @param percentage - Percentage value
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(
  percentage: number | null | undefined,
  decimals: number = 1
): string {
  if (percentage === null || percentage === undefined || isNaN(percentage)) {
    return '0%'
  }

  const formatted = percentage.toFixed(decimals)
  
  if (percentage > 0) {
    return `+${formatted}%`
  }
  
  return `${formatted}%`
}

/**
 * Returns the appropriate color class for a variance value
 * Positive = under budget (green), Negative = over budget (red)
 * 
 * @param variance - Variance amount
 * @returns Tailwind color class
 */
export function getVarianceColorClass(variance: number | null | undefined): string {
  if (variance === null || variance === undefined) {
    return 'text-gray-500'
  }
  
  if (variance > 0) {
    return 'text-green-600'
  } else if (variance < 0) {
    return 'text-red-600'
  }
  
  return 'text-gray-500'
}

/**
 * Returns the appropriate background color class for a variance value
 * 
 * @param variance - Variance amount
 * @returns Tailwind background color class
 */
export function getVarianceBgColorClass(variance: number | null | undefined): string {
  if (variance === null || variance === undefined) {
    return 'bg-gray-100'
  }
  
  if (variance > 0) {
    return 'bg-green-100'
  } else if (variance < 0) {
    return 'bg-red-100'
  }
  
  return 'bg-gray-100'
}