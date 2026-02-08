'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from '@/lib/i18n/context'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { 
  BarChart3, TrendingUp, DollarSign, Users, LayoutGrid, 
  LayoutList, Grid3X3, Check, Info
} from 'lucide-react'
import { useSettings, type DashboardKPIs } from '@/hooks/useSettings'

const LAYOUT_OPTIONS = [
  { value: 'grid', icon: Grid3X3 },
  { value: 'masonry', icon: LayoutGrid },
  { value: 'list', icon: LayoutList },
] as const

export function DashboardSettings() {
  const { t } = useTranslations()
  const SUCCESS_RATE_METHODS = [
    { value: 'health', label: t('settings.successRateHealth') },
    { value: 'completion', label: t('settings.successRateCompletion') },
  ]
  const BUDGET_METHODS = [
    { value: 'spent', label: t('settings.budgetSpent') },
    { value: 'remaining', label: t('settings.budgetRemaining') },
  ]
  const RESOURCE_METHODS = [
    { value: 'auto', label: t('settings.resourceAuto') },
    { value: 'fixed', label: t('settings.resourceFixed') },
  ]
  const layoutOptions = [
    { value: 'grid', label: t('settings.layoutGrid'), icon: Grid3X3 },
    { value: 'masonry', label: t('settings.layoutMasonry'), icon: LayoutGrid },
    { value: 'list', label: t('settings.layoutList'), icon: LayoutList },
  ]
  const { settings, updateSetting, loading, saving } = useSettings()
  
  const [kpiSettings, setKpiSettings] = useState<DashboardKPIs>({
    successRateMethod: 'health',
    budgetMethod: 'spent',
    resourceMethod: 'auto',
    resourceFixedValue: 85,
  })
  const [layout, setLayout] = useState<'grid' | 'masonry' | 'list'>('grid')
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (settings) {
      setKpiSettings(settings.dashboardKPIs || {
        successRateMethod: 'health',
        budgetMethod: 'spent',
        resourceMethod: 'auto',
        resourceFixedValue: 85,
      })
      setLayout(settings.dashboardLayout?.layout || 'grid')
    }
  }, [settings])

  const handleKpiChange = <K extends keyof DashboardKPIs>(key: K, value: DashboardKPIs[K]) => {
    setKpiSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    await updateSetting('dashboardKPIs', kpiSettings)
    await updateSetting('dashboardLayout', { 
      ...settings?.dashboardLayout,
      layout 
    })
    setHasChanges(false)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-slate-700 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* KPI Calculation Methods */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-slate-100">
          <BarChart3 className="h-5 w-5 text-gray-600 dark:text-slate-400" />
          <span>{t('settings.kpiMethods') || 'KPI Calculation Methods'}</span>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {t('settings.kpiMethodsInfo') || 'These settings control how KPI values are calculated on your dashboard. Changes will apply immediately after saving.'}
          </p>
        </div>

        {/* Success Rate Method */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              {t('settings.successRateMethod') || 'Success Rate Calculation'}
            </div>
          </label>
          <Select
            value={kpiSettings.successRateMethod}
            onChange={(value) => handleKpiChange('successRateMethod', value as 'health' | 'completion')}
            options={SUCCESS_RATE_METHODS}
            className="w-full max-w-md"
          />
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {kpiSettings.successRateMethod === 'health' 
              ? t('settings.successRateHealthDesc')
              : t('settings.successRateCompletionDesc')}
          </p>
        </div>

        {/* Budget Performance Method */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              {t('settings.budgetMethod') || 'Budget Performance Calculation'}
            </div>
          </label>
          <Select
            value={kpiSettings.budgetMethod}
            onChange={(value) => handleKpiChange('budgetMethod', value as 'spent' | 'remaining')}
            options={BUDGET_METHODS}
            className="w-full max-w-md"
          />
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {kpiSettings.budgetMethod === 'spent'
              ? t('settings.budgetSpentDesc')
              : t('settings.budgetRemainingDesc')}
          </p>
        </div>

        {/* Resource Efficiency Method */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              {t('settings.resourceMethod') || 'Resource Efficiency Calculation'}
            </div>
          </label>
          <Select
            value={kpiSettings.resourceMethod}
            onChange={(value) => handleKpiChange('resourceMethod', value as 'auto' | 'fixed')}
            options={RESOURCE_METHODS}
            className="w-full max-w-md"
          />
          
          {kpiSettings.resourceMethod === 'fixed' && (
            <div className="mt-3 flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={100}
                value={kpiSettings.resourceFixedValue}
                onChange={(e) => handleKpiChange('resourceFixedValue', parseInt(e.target.value) || 0)}
                className="w-24"
              />
              <span className="text-sm text-gray-500 dark:text-slate-400">%</span>
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {kpiSettings.resourceMethod === 'auto'
              ? t('settings.resourceAutoDesc')
              : t('settings.resourceFixedDesc')}
          </p>
        </div>
      </div>

      {/* Dashboard Layout */}
      <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-slate-100">
          <LayoutGrid className="h-5 w-5 text-gray-600 dark:text-slate-400" />
          <span>{t('settings.dashboardLayout') || 'Dashboard Layout'}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {layoutOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => {
                setLayout(value as 'grid' | 'masonry' | 'list')
                setHasChanges(true)
              }}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                layout === value
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                  : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 text-gray-600 dark:text-slate-300'
              }`}
            >
              <Icon className="h-6 w-6 text-inherit" aria-hidden />
              <span className="text-sm font-medium text-inherit">{label}</span>
            </button>
          ))}
        </div>
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
