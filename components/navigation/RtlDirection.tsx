'use client'

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/types'

/**
 * Sets document direction (dir) and lang from current locale.
 * RTL when locale has rtl: true in SUPPORTED_LANGUAGES (e.g. for future RTL locales).
 */
export function RtlDirection () {
  const { locale } = useI18n()

  useEffect(() => {
    const meta = SUPPORTED_LANGUAGES.find((l) => l.code === locale)
    const dir = meta?.rtl === true ? 'rtl' : 'ltr'
    const lang = locale.split('-')[0]
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('dir', dir)
      document.documentElement.setAttribute('lang', lang)
    }
  }, [locale])

  return null
}
