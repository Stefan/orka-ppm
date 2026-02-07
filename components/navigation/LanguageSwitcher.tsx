'use client'

/**
 * LanguageSwitcher – Topbar dropdown for locale selection.
 * Uses SUPPORTED_LANGUAGES from lib/i18n/types (en, de, fr, es, pl, gsw, es-MX, zh-CN, hi-IN, ja-JP, ko-KR, vi-VN).
 * Wraps GlobalLanguageSelector for consistent naming with docs (Design.md / Tasks.md).
 */
import { GlobalLanguageSelector } from './GlobalLanguageSelector'

export type LanguageSwitcherVariant = 'sidebar' | 'topbar' | 'dropdown'

export interface LanguageSwitcherProps {
  variant?: LanguageSwitcherVariant
}

export function LanguageSwitcher({ variant = 'topbar' }: LanguageSwitcherProps) {
  return <GlobalLanguageSelector variant={variant} />
}

export default LanguageSwitcher
