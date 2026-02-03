'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from '@/lib/i18n/context'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Sun, Moon, Monitor, Clock, DollarSign, Check } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useTheme } from '@/app/providers/ThemeProvider'

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
  { value: 'America/New_York', label: 'America/New York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'CHF', label: 'CHF (Fr.)' },
  { value: 'GBP', label: 'GBP (£)' },
]

type Theme = 'light' | 'dark' | 'system'

export function GeneralSettings() {
  const { t } = useTranslations()
  const { settings, updateSetting, loading, saving } = useSettings()
  const { theme: currentTheme, setTheme: setGlobalTheme } = useTheme()
  
  const [timezone, setTimezone] = useState(settings?.timezone || 'UTC')
  const [currency, setCurrency] = useState(settings?.currency || 'USD')
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (settings) {
      setTimezone(settings.timezone || 'UTC')
      setCurrency(settings.currency || 'USD')
    }
  }, [settings])

  const handleThemeChange = async (newTheme: Theme) => {
    // Apply theme immediately via ThemeProvider
    setGlobalTheme(newTheme)
    // Also save to preferences
    await updateSetting('theme', newTheme)
  }

  const handleSave = async () => {
    await updateSetting('timezone', timezone)
    await updateSetting('currency', currency)
    setHasChanges(false)
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
          options={TIMEZONES}
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
            setCurrency(value)
            setHasChanges(true)
          }}
          options={CURRENCIES}
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
