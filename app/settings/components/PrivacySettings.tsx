'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from '@/lib/i18n/context'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/Button'
import { 
  Sparkles, MessageSquare, Zap, Shield, Check, Info
} from 'lucide-react'
import { useSettings, type AISettings } from '@/hooks/useSettings'

interface SettingToggleProps {
  icon: React.ElementType
  iconColor: string
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function SettingToggle({ icon: Icon, iconColor, title, description, checked, onChange }: SettingToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${iconColor}`}>
          <Icon className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100">{title}</h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      <Switch 
        checked={checked} 
        onCheckedChange={onChange}
      />
    </div>
  )
}

export function PrivacySettings() {
  const { t } = useTranslations()
  const { settings, updateSetting, loading, saving } = useSettings()
  
  const [aiSettings, setAiSettings] = useState<AISettings>({
    enableSuggestions: true,
    enablePredictiveText: true,
    enableAutoOptimization: false,
  })
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (settings?.aiSettings) {
      setAiSettings(settings.aiSettings)
    }
  }, [settings])

  const handleToggle = (key: keyof AISettings, value: boolean) => {
    setAiSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    await updateSetting('aiSettings', aiSettings)
    setHasChanges(false)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-slate-700 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-sm text-purple-800 dark:text-purple-200">
            {t('settings.aiPrivacyInfo') || 'AI features help you work more efficiently. Your data is processed securely and never shared with third parties.'}
          </p>
        </div>
      </div>

      {/* AI Feature Toggles */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-slate-100">
          <Sparkles className="h-5 w-5 text-gray-600 dark:text-slate-400" aria-hidden />
          <span>{t('settings.aiFeatures') || 'AI Features'}</span>
        </div>

        <div className="space-y-3">
          <SettingToggle
            icon={Sparkles}
            iconColor="bg-purple-500"
            title={t('settings.aiSuggestions') || 'AI Suggestions'}
            description={t('settings.aiSuggestionsDesc') || 'Get intelligent suggestions for project planning, risk mitigation, and resource allocation'}
            checked={aiSettings.enableSuggestions}
            onChange={(checked) => handleToggle('enableSuggestions', checked)}
          />

          <SettingToggle
            icon={MessageSquare}
            iconColor="bg-blue-500"
            title={t('settings.predictiveText') || 'Predictive Text'}
            description={t('settings.predictiveTextDesc') || 'Enable smart text completion when writing descriptions and comments'}
            checked={aiSettings.enablePredictiveText}
            onChange={(checked) => handleToggle('enablePredictiveText', checked)}
          />

          <SettingToggle
            icon={Zap}
            iconColor="bg-amber-500"
            title={t('settings.autoOptimization') || 'Auto-Optimization'}
            description={t('settings.autoOptimizationDesc') || 'Automatically optimize schedules and resource allocation based on project patterns'}
            checked={aiSettings.enableAutoOptimization}
            onChange={(checked) => handleToggle('enableAutoOptimization', checked)}
          />
        </div>
      </div>

      {/* Data Privacy Section */}
      <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-slate-100">
          <Shield className="h-5 w-5 text-gray-600 dark:text-slate-400" aria-hidden />
          <span>{t('settings.dataPrivacy') || 'Data Privacy'}</span>
        </div>

        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400 shrink-0" aria-hidden />
            <span className="text-sm text-gray-700 dark:text-slate-300">
              {t('settings.dataEncrypted') || 'Your data is encrypted at rest and in transit'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400 shrink-0" aria-hidden />
            <span className="text-sm text-gray-700 dark:text-slate-300">
              {t('settings.dataNotShared') || 'Data is never shared with third parties'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400 shrink-0" aria-hidden />
            <span className="text-sm text-gray-700 dark:text-slate-300">
              {t('settings.aiProcessedSecurely') || 'AI processing happens on secure, isolated infrastructure'}
            </span>
          </div>
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
