/**
 * useDateFormatter
 * Formats dates according to the user's date format preference (Settings → General).
 * Default "browser" uses the app's current language locale (from i18n) for date/time zone.
 */

import { useCallback } from 'react'
import { useSettings } from './useSettings'
import { useI18n } from '@/lib/i18n/context'
import type { DateFormatPreference } from '@/lib/sync/cross-device-sync'

export interface UseDateFormatterReturn {
  /** Format a date per user preference (dateFormat setting). Default options: year, month, day. */
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string
  /** Resolved locale used for formatting (undefined = browser default). */
  dateLocale: string | undefined
  /** User's dateFormat preference. */
  dateFormat: DateFormatPreference
}

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}

/**
 * Returns a formatDate function that respects the user's date format setting.
 * Use in components that display dates so the app stays consistent with Settings → Date format.
 */
export function useDateFormatter(): UseDateFormatterReturn {
  const { settings } = useSettings()
  const { locale: appLocale, localeFormat } = useI18n()
  const preference: DateFormatPreference = settings?.dateFormat ?? 'browser'

  const formatDate = useCallback(
    (date: Date, options?: Intl.DateTimeFormatOptions): string => {
      const opts = { ...DEFAULT_OPTIONS, ...options }
      const hasTime = 'timeStyle' in opts
      if (preference === 'iso') {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        const datePart = `${y}-${m}-${d}`
        if (hasTime) {
          const h = String(date.getHours()).padStart(2, '0')
          const min = String(date.getMinutes()).padStart(2, '0')
          const s = String(date.getSeconds()).padStart(2, '0')
          return `${datePart} ${h}:${min}:${s}`
        }
        return datePart
      }
      // 'browser': use app language's date locale and time zone
      const locale = preference === 'browser' ? localeFormat.dateLocale : preference
      const timeZone = preference === 'browser' ? localeFormat.timeZone : undefined
      try {
        const formatOpts: Intl.DateTimeFormatOptions = { ...opts }
        if (timeZone) formatOpts.timeZone = timeZone
        if (hasTime) return date.toLocaleString(locale, formatOpts)
        return date.toLocaleDateString(locale, formatOpts)
      } catch (e) {
        if (hasTime) return date.toLocaleString(undefined, { timeStyle: 'short', dateStyle: 'short' })
        return date.toLocaleDateString(undefined, { dateStyle: 'short' })
      }
    },
    [preference, appLocale, localeFormat]
  )

  const dateLocale = preference === 'browser' ? localeFormat.dateLocale : preference

  return {
    formatDate,
    dateLocale,
    dateFormat: preference,
  }
}

