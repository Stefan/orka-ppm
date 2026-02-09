'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations, useI18n } from '@/lib/i18n/context'
import { getLocaleFormat } from '@/lib/i18n/locale-config'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Sun, Moon, Monitor, Clock, DollarSign, Check, Calendar } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useTheme } from '@/app/providers/ThemeProvider'
import { logger } from '@/lib/monitoring/logger'
import { debugIngest } from '@/lib/debug-ingest'

// Base order: UTC, then Europe, Americas, Asia (by city name)
const TIMEZONES_BASE = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw (CET)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST)' },
  { value: 'America/Mexico_City', label: 'America/Mexico City (CST)' },
  { value: 'America/New_York', label: 'America/New York (EST)' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho Chi Minh (ICT)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
]

// Base order: major first, then alphabetical
const CURRENCIES_BASE = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'CHF', label: 'CHF (Fr.)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'INR', label: 'INR (₹)' },
  { value: 'KRW', label: 'KRW (₩)' },
  { value: 'MXN', label: 'MXN ($)' },
  { value: 'PLN', label: 'PLN (zł)' },
  { value: 'VND', label: 'VND (₫)' },
]

const DATE_FORMAT_OPTIONS_BASE: { value: DateFormatValue; labelKey: string; labelEn: string }[] = [
  { value: 'browser', labelKey: 'settings.dateFormatBrowser', labelEn: 'Browser default' },
  { value: 'de-DE', labelKey: 'settings.dateFormatDe', labelEn: 'German (DD.MM.YYYY)' },
  { value: 'en-GB', labelKey: 'settings.dateFormatEnGb', labelEn: 'UK (DD/MM/YYYY)' },
  { value: 'fr-FR', labelKey: '', labelEn: 'French (DD/MM/YYYY)' },
  { value: 'es-ES', labelKey: '', labelEn: 'Spanish (DD/MM/YYYY)' },
  { value: 'pl-PL', labelKey: '', labelEn: 'Polish (DD.MM.YYYY)' },
  { value: 'de-CH', labelKey: '', labelEn: 'Swiss German (DD.MM.YYYY)' },
  { value: 'en-US', labelKey: 'settings.dateFormatEnUs', labelEn: 'US (MM/DD/YYYY)' },
  { value: 'es-MX', labelKey: '', labelEn: 'Spanish Mexico (DD/MM/YYYY)' },
  { value: 'zh-CN', labelKey: '', labelEn: 'Chinese (YYYY/MM/DD)' },
  { value: 'hi-IN', labelKey: '', labelEn: 'Hindi India (DD/MM/YYYY)' },
  { value: 'ja-JP', labelKey: '', labelEn: 'Japanese (YYYY/MM/DD)' },
  { value: 'ko-KR', labelKey: '', labelEn: 'Korean (YYYY. MM. DD)' },
  { value: 'vi-VN', labelKey: '', labelEn: 'Vietnamese (DD/MM/YYYY)' },
  { value: 'iso', labelKey: 'settings.dateFormatIso', labelEn: 'ISO (YYYY-MM-DD)' },
]

type DateFormatValue = 'browser' | 'de-DE' | 'en-US' | 'en-GB' | 'fr-FR' | 'es-ES' | 'pl-PL' | 'de-CH' | 'es-MX' | 'zh-CN' | 'hi-IN' | 'ja-JP' | 'ko-KR' | 'vi-VN' | 'iso'

type Theme = 'light' | 'dark' | 'system'

export function GeneralSettings() {
  const { t } = useTranslations()
  const { locale } = useI18n()
  const { settings, updateSetting, loading, saving } = useSettings()
  const { theme: currentTheme, setTheme: setGlobalTheme } = useTheme()
  const localeFormat = getLocaleFormat(locale)

  const [timezone, setTimezone] = useState(settings?.timezone || 'UTC')
  const [currency, setCurrency] = useState(settings?.currency || 'USD')
  const [dateFormat, setDateFormat] = useState<DateFormatValue>(settings?.dateFormat || 'browser')
  const [hasChanges, setHasChanges] = useState(false)

  // Context-sensitive sort: option matching current app language (locale) first, then base order
  const timezoneOptions = useMemo(() => {
    const match = TIMEZONES_BASE.find((o) => o.value === localeFormat.timeZone)
    if (!match) return TIMEZONES_BASE
    return [match, ...TIMEZONES_BASE.filter((o) => o.value !== localeFormat.timeZone)]
  }, [localeFormat.timeZone])

  const currencyOptions = useMemo(() => {
    const match = CURRENCIES_BASE.find((o) => o.value === localeFormat.defaultCurrency)
    if (!match) return CURRENCIES_BASE
    return [match, ...CURRENCIES_BASE.filter((o) => o.value !== localeFormat.defaultCurrency)]
  }, [localeFormat.defaultCurrency])

  const dateFormatOptions = useMemo(() => {
    const withLabels = DATE_FORMAT_OPTIONS_BASE.map((o) => ({
      value: o.value,
      label: o.labelKey ? (t(o.labelKey) || o.labelEn) : o.labelEn,
    }))
    const match = withLabels.find((opt) => opt.value === localeFormat.dateLocale)
    if (!match || match.value === 'browser') return withLabels
    return [withLabels[0], match, ...withLabels.slice(1).filter((o) => o.value !== localeFormat.dateLocale)]
  }, [localeFormat.dateLocale, t])

  useEffect(() => {
    if (settings) {
      setTimezone(settings.timezone || 'UTC')
      setCurrency(settings.currency || 'USD')
      setDateFormat((settings.dateFormat as DateFormatValue) || 'browser')
    }
  }, [settings])

  const handleThemeChange = async (newTheme: Theme) => {
    // #region agent log
    debugIngest({ location: 'GeneralSettings.tsx:handleThemeChange:before', message: 'handleThemeChange BEFORE setGlobalTheme', data: { newTheme, currentTheme, htmlClass: document.documentElement.className, dataTheme: document.documentElement.getAttribute('data-theme') }, sessionId: 'debug-session', hypothesisId: 'H1,H5' })
    // #endregion
    // Apply theme immediately via ThemeProvider
    setGlobalTheme(newTheme)
    // #region agent log
    debugIngest({ location: 'GeneralSettings.tsx:handleThemeChange:after', message: 'handleThemeChange AFTER setGlobalTheme', data: { newTheme, htmlClass: document.documentElement.className, dataTheme: document.documentElement.getAttribute('data-theme'), bodyBg: document.body.style.backgroundColor }, sessionId: 'debug-session', hypothesisId: 'H1,H4,H5' })
    // #endregion
    // Also save to preferences (non-blocking)
    try {
      await updateSetting('theme', newTheme === 'system' ? 'auto' : newTheme)
    } catch {
      logger.warn('Theme preference sync failed, using local setting', undefined, 'GeneralSettings')
    }
    // #region agent log
    debugIngest({ location: 'GeneralSettings.tsx:handleThemeChange:done', message: 'handleThemeChange COMPLETED (after sync attempt)', data: { htmlClass: document.documentElement.className, dataTheme: document.documentElement.getAttribute('data-theme'), bodyBg: document.body.style.backgroundColor, hasDarkClass: document.documentElement.classList.contains('dark') }, sessionId: 'debug-session', hypothesisId: 'H5' })
    // #endregion
  }

  const handleSave = async () => {
    try {
      await updateSetting('timezone', timezone)
      await updateSetting('currency', currency)
      await updateSetting('dateFormat', dateFormat)
      setHasChanges(false)
    } catch {
      logger.warn('Settings sync failed, changes saved locally', undefined, 'GeneralSettings')
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-slate-700 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-gray-600 dark:text-slate-400" aria-hidden />
            {t('settings.theme') || 'Theme'}
          </div>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'light', icon: Sun, label: t('settings.themeLight') || 'Light' },
            { value: 'dark', icon: Moon, label: t('settings.themeDark') || 'Dark' },
            { value: 'system', icon: Monitor, label: t('settings.themeSystem') || 'System' },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => handleThemeChange(value as Theme)}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                currentTheme === value
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <Icon className="h-6 w-6 text-inherit" aria-hidden />
              <span className="text-sm font-medium text-inherit">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date format */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-600 dark:text-slate-400" aria-hidden />
            {t('settings.dateFormat') || 'Date format'}
          </div>
        </label>
        <Select
          value={dateFormat}
          onChange={(value) => {
            setDateFormat(value as DateFormatValue)
            setHasChanges(true)
          }}
          options={dateFormatOptions}
          className="w-full max-w-xs"
        />
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {t('settings.dateFormatHint') || 'How dates are displayed. Default uses your browser language.'}
        </p>
      </div>

      {/* Timezone Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-600 dark:text-slate-400" aria-hidden />
            {t('settings.timezone') || 'Timezone'}
          </div>
        </label>
        <Select
          value={timezone}
          onChange={(value) => {
            setTimezone(value)
            setHasChanges(true)
          }}
          options={timezoneOptions}
          className="w-full max-w-xs"
        />
      </div>

      {/* Currency Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-600 dark:text-slate-400" aria-hidden />
            {t('settings.currency') || 'Default Currency'}
          </div>
        </label>
        <Select
          value={currency}
          onChange={(value) => {
            setCurrency(value as typeof currency)
            setHasChanges(true)
          }}
          options={currencyOptions}
          className="w-full max-w-xs"
        />
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {t('settings.currencyHint') || 'Used for displaying financial data across the application'}
        </p>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {saving ? (t('common.saving') || 'Saving...') : (t('common.saveChanges') || 'Save Changes')}
          </Button>
        </div>
      )}
    </div>
  )
}
