'use client'

import { useEffect } from 'react'
import { useI18nOptional } from '@/lib/i18n/context'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/types'

/**
 * Sets document direction (dir) and lang from current locale.
 * RTL when locale has rtl: true in SUPPORTED_LANGUAGES (e.g. for future RTL locales).
 * No-ops when not within I18nProvider (e.g. ErrorBoundary fallback or DevTools).
 */
export function RtlDirection () {
  const i18n = useI18nOptional()
  const locale = i18n?.locale ?? 'en'

  useEffect(() => {
    if (!i18n) return
    const meta = SUPPORTED_LANGUAGES.find((l) => l.code === locale)
    const dir = meta?.rtl === true ? 'rtl' : 'ltr'
    const lang = locale.split('-')[0]
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('dir', dir)
      document.documentElement.setAttribute('lang', lang)
    }
  }, [locale, i18n])

  return null
}
