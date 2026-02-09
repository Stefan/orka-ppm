/**
 * Locale-specific formatting utilities
 * 
 * This module provides functions for formatting dates, numbers, currencies,
 * and relative times according to locale conventions using the Intl API.
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { SupportedLocale } from './types';

/**
 * Locale to Intl locale mapping
 * Maps our supported locale codes to full Intl locale identifiers
 */
const LOCALE_MAP: Record<SupportedLocale, string> = {
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  pl: 'pl-PL',
  gsw: 'de-CH', // Swiss German uses Swiss formatting conventions
  'es-MX': 'es-MX',
  'zh-CN': 'zh-CN',
  'hi-IN': 'hi-IN',
  'ja-JP': 'ja-JP',
  'ko-KR': 'ko-KR',
  'vi-VN': 'vi-VN',
};

/**
 * Format a date according to locale conventions
 * 
 * @param date - The date to format
 * @param locale - The locale to use for formatting
 * @param options - Optional Intl.DateTimeFormat options
 * @returns Formatted date string
 * 
 * @example
 * formatDate(new Date('2024-01-15'), 'en') // "January 15, 2024"
 * formatDate(new Date('2024-01-15'), 'de') // "15. Januar 2024"
 * formatDate(new Date('2024-01-15'), 'fr') // "15 janvier 2024"
 * 
 * **Validates: Requirements 11.1**
 */
export function formatDate(
  date: Date,
  locale: SupportedLocale,
  options?: Intl.DateTimeFormatOptions
): string {
  const intlLocale = LOCALE_MAP[locale];
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(intlLocale, defaultOptions).format(date);
  } catch (error) {
    console.error('Date formatting error:', error);
    // Fallback to basic date string
    return date.toLocaleDateString();
  }
}

/**
 * Format a number according to locale conventions
 * 
 * @param number - The number to format
 * @param locale - The locale to use for formatting
 * @param options - Optional Intl.NumberFormat options
 * @returns Formatted number string
 * 
 * @example
 * formatNumber(1234.56, 'en') // "1,234.56"
 * formatNumber(1234.56, 'de') // "1.234,56"
 * formatNumber(1234.56, 'fr') // "1 234,56"
 * 
 * **Validates: Requirements 11.2**
 */
export function formatNumber(
  number: number,
  locale: SupportedLocale,
  options?: Intl.NumberFormatOptions
): string {
  const intlLocale = LOCALE_MAP[locale];

  try {
    return new Intl.NumberFormat(intlLocale, options).format(number);
  } catch (error) {
    console.error('Number formatting error:', error);
    // Fallback to basic number string
    return number.toString();
  }
}

/**
 * Format currency according to locale conventions
 * 
 * @param amount - The amount to format
 * @param locale - The locale to use for formatting
 * @param currency - The currency code (ISO 4217), defaults to EUR
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(1234.56, 'en', 'USD') // "$1,234.56"
 * formatCurrency(1234.56, 'de', 'EUR') // "1.234,56 €"
 * formatCurrency(1234.56, 'fr', 'EUR') // "1 234,56 €"
 * 
 * **Validates: Requirements 11.3**
 */
export function formatCurrency(
  amount: number,
  locale: SupportedLocale,
  currency: string = 'EUR'
): string {
  const intlLocale = LOCALE_MAP[locale];

  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch (error) {
    console.error('Currency formatting error:', error);
    // Fallback to basic currency string
    return `${currency} ${amount}`;
  }
}

/**
 * Format relative time (e.g., "2 days ago", "in 3 hours")
 * 
 * @param date - The date to format relative to baseDate
 * @param locale - The locale to use for formatting
 * @param baseDate - The reference date (defaults to current date/time)
 * @returns Formatted relative time string
 * 
 * @example
 * formatRelativeTime(new Date('2024-01-13'), 'en', new Date('2024-01-15')) // "2 days ago"
 * formatRelativeTime(new Date('2024-01-13'), 'de', new Date('2024-01-15')) // "vor 2 Tagen"
 * formatRelativeTime(new Date('2024-01-13'), 'fr', new Date('2024-01-15')) // "il y a 2 jours"
 * 
 * **Validates: Requirements 11.4**
 */
export function formatRelativeTime(
  date: Date,
  locale: SupportedLocale,
  baseDate: Date = new Date()
): string {
  const intlLocale = LOCALE_MAP[locale];
  const diffInSeconds = Math.floor((baseDate.getTime() - date.getTime()) / 1000);

  // Define time units in descending order
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],   // 365 * 24 * 60 * 60
    ['month', 2592000],   // 30 * 24 * 60 * 60
    ['week', 604800],     // 7 * 24 * 60 * 60
    ['day', 86400],       // 24 * 60 * 60
    ['hour', 3600],       // 60 * 60
    ['minute', 60],
    ['second', 1],
  ];

  try {
    const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' });

    // Find the appropriate unit
    for (const [unit, secondsInUnit] of units) {
      if (Math.abs(diffInSeconds) >= secondsInUnit) {
        const value = Math.floor(diffInSeconds / secondsInUnit);
        return rtf.format(-value, unit);
      }
    }

    // If less than a second, return "now" equivalent
    return rtf.format(0, 'second');
  } catch (error) {
    console.error('Relative time formatting error:', error);
    // Fallback to basic date string
    return date.toLocaleDateString();
  }
}
