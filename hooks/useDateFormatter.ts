/**
 * useDateFormatter
 * Formats dates according to the user's date format preference (Settings → General).
 * Default "browser" uses the browser's locale (navigator.language).
 */

import { useCallback } from 'react'
import { useSettings } from './useSettings'
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
  const preference: DateFormatPreference = settings?.dateFormat ?? 'browser'

  const formatDate = useCallback(
    (date: Date, options?: Intl.DateTimeFormatOptions): string => {
      // #region agent log
      const optKeys = options ? Object.keys(options) : []
      fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDateFormatter.ts:formatDate:entry',message:'formatDate entry',data:{optionKeys:optKeys,hasOptionKey:optKeys.includes('option')},timestamp:Date.now(),hypothesisId:'H2,H3,H4'})}).catch(()=>{})
      // #endregion
      const opts = { ...DEFAULT_OPTIONS, ...options }
      const hasTime = 'timeStyle' in opts
      // #region agent log
      const optsKeys = Object.keys(opts)
      fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDateFormatter.ts:formatDate:afterMerge',message:'opts after merge',data:{optsKeys,hasDateStyle:'dateStyle' in opts,hasTimeStyle:'timeStyle' in opts,hasYearMonthDay:optsKeys.filter(k=>['year','month','day'].includes(k))},timestamp:Date.now(),hypothesisId:'H1,H4,H5'})}).catch(()=>{})
      // #endregion
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
      const locale = preference === 'browser' ? undefined : preference
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDateFormatter.ts:formatDate:beforeToLocale',message:'before toLocale',data:{optsKeys:Object.keys(opts),hasTime},timestamp:Date.now(),hypothesisId:'H1,H5'})}).catch(()=>{})
        // #endregion
        if (hasTime) return date.toLocaleString(locale, opts)
        return date.toLocaleDateString(locale, opts)
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDateFormatter.ts:formatDate:catch',message:'toLocale threw',data:{err:String(e),optsKeys:Object.keys(opts)},timestamp:Date.now(),hypothesisId:'H1,H5'})}).catch(()=>{})
        // #endregion
        // Fallback: use only dateStyle/timeStyle (no year/month/day) so Intl accepts
        if (hasTime) return date.toLocaleString(undefined, { timeStyle: 'short', dateStyle: 'short' })
        return date.toLocaleDateString(undefined, { dateStyle: 'short' })
      }
    },
    [preference]
  )

  const dateLocale = preference === 'browser' ? undefined : preference

  return {
    formatDate,
    dateLocale,
    dateFormat: preference,
  }
}
