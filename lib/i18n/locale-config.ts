/**
 * Locale configuration: date format locale, default currency, and time zone
 * per supported language. Used for Intl formatting when app language is set.
 */

import type { SupportedLocale } from './types'

export interface LocaleFormatConfig {
  /** Intl locale for date/number formatting (e.g. 'de-DE', 'en-US') */
  dateLocale: string
  /** Default currency code for this locale */
  defaultCurrency: string
  /** IANA time zone (e.g. 'Europe/Berlin') */
  timeZone: string
}

const LOCALE_FORMAT: Record<SupportedLocale, LocaleFormatConfig> = {
  en: { dateLocale: 'en-US', defaultCurrency: 'USD', timeZone: 'America/New_York' },
  de: { dateLocale: 'de-DE', defaultCurrency: 'EUR', timeZone: 'Europe/Berlin' },
  fr: { dateLocale: 'fr-FR', defaultCurrency: 'EUR', timeZone: 'Europe/Paris' },
  es: { dateLocale: 'es-ES', defaultCurrency: 'EUR', timeZone: 'Europe/Madrid' },
  pl: { dateLocale: 'pl-PL', defaultCurrency: 'PLN', timeZone: 'Europe/Warsaw' },
  gsw: { dateLocale: 'de-CH', defaultCurrency: 'CHF', timeZone: 'Europe/Zurich' },
  'es-MX': { dateLocale: 'es-MX', defaultCurrency: 'MXN', timeZone: 'America/Mexico_City' },
  'zh-CN': { dateLocale: 'zh-CN', defaultCurrency: 'CNY', timeZone: 'Asia/Shanghai' },
  'hi-IN': { dateLocale: 'hi-IN', defaultCurrency: 'INR', timeZone: 'Asia/Kolkata' },
  'ja-JP': { dateLocale: 'ja-JP', defaultCurrency: 'JPY', timeZone: 'Asia/Tokyo' },
  'ko-KR': { dateLocale: 'ko-KR', defaultCurrency: 'KRW', timeZone: 'Asia/Seoul' },
  'vi-VN': { dateLocale: 'vi-VN', defaultCurrency: 'VND', timeZone: 'Asia/Ho_Chi_Minh' },
}

/**
 * Get date locale, default currency, and time zone for a given app locale.
 * Falls back to en-US/USD/America/New_York for unknown locales.
 */
export function getLocaleFormat(locale: string): LocaleFormatConfig {
  const key = locale as SupportedLocale
  return LOCALE_FORMAT[key] ?? LOCALE_FORMAT.en
}

/**
 * Format a date using the locale's dateLocale and optional timeZone.
 */
export function formatDateForLocale(
  date: Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const { dateLocale, timeZone } = getLocaleFormat(locale)
  return date.toLocaleDateString(dateLocale, { ...options, timeZone })
}

/**
 * Format a number as currency using the locale's default currency (or override).
 */
export function formatCurrencyForLocale(
  value: number,
  locale: string,
  currency?: string
): string {
  const { dateLocale, defaultCurrency } = getLocaleFormat(locale)
  return new Intl.NumberFormat(dateLocale, {
    style: 'currency',
    currency: currency ?? defaultCurrency,
  }).format(value)
}
