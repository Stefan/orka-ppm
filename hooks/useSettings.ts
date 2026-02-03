/**
 * useSettings Hook
 * Simplified interface for accessing and updating user settings
 * Wraps useCrossDeviceSync for easier component integration
 */

import { useState, useCallback, useEffect } from 'react'
import { useCrossDeviceSync } from './useCrossDeviceSync'
import { 
  UserPreferences, 
  DashboardKPIs, 
  AISettings 
} from '@/lib/sync/cross-device-sync'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'

// Re-export types for convenience
export type { DashboardKPIs, AISettings, UserPreferences }

export interface UseSettingsReturn {
  settings: UserPreferences | null
  loading: boolean
  saving: boolean
  error: string | null
  updateSetting: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => Promise<void>
  updateSettings: (updates: Partial<UserPreferences>) => Promise<void>
  resetToDefaults: () => Promise<void>
}

/**
 * Hook for managing user settings
 * Provides a simple interface for reading and updating preferences
 */
export function useSettings(): UseSettingsReturn {
  const { session } = useAuth()
  const { 
    preferences, 
    updatePreferences, 
    initialize, 
    isSyncing 
  } = useCrossDeviceSync()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Initialize sync when user is authenticated
  useEffect(() => {
    async function init() {
      if (session?.user?.id && !initialized) {
        try {
          setLoading(true)
          await initialize(session.user.id)
          setInitialized(true)
        } catch (err) {
          console.error('Failed to initialize settings:', err)
          setError('Failed to load settings')
        } finally {
          setLoading(false)
        }
      } else if (!session?.user?.id) {
        setLoading(false)
      }
    }
    init()
  }, [session?.user?.id, initialize, initialized])

  // Update loading state when syncing changes
  useEffect(() => {
    if (initialized && !isSyncing) {
      setLoading(false)
    }
  }, [initialized, isSyncing])

  /**
   * Update a single setting
   */
  const updateSetting = useCallback(async <K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ) => {
    try {
      setSaving(true)
      setError(null)
      await updatePreferences({ [key]: value })
    } catch (err) {
      console.error(`Failed to update setting ${key}:`, err)
      setError(`Failed to save ${key}`)
      throw err
    } finally {
      setSaving(false)
    }
  }, [updatePreferences])

  /**
   * Update multiple settings at once
   */
  const updateSettings = useCallback(async (updates: Partial<UserPreferences>) => {
    try {
      setSaving(true)
      setError(null)
      await updatePreferences(updates)
    } catch (err) {
      console.error('Failed to update settings:', err)
      setError('Failed to save settings')
      throw err
    } finally {
      setSaving(false)
    }
  }, [updatePreferences])

  /**
   * Reset settings to defaults
   */
  const resetToDefaults = useCallback(async () => {
    const defaults: Partial<UserPreferences> = {
      theme: 'auto',
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      currency: 'USD',
      dashboardLayout: {
        widgets: [],
        layout: 'grid'
      },
      dashboardKPIs: {
        successRateMethod: 'health',
        budgetMethod: 'spent',
        resourceMethod: 'auto',
        resourceFixedValue: 85
      },
      aiSettings: {
        enableSuggestions: true,
        enablePredictiveText: true,
        enableAutoOptimization: false
      }
    }

    try {
      setSaving(true)
      setError(null)
      await updatePreferences(defaults)
    } catch (err) {
      console.error('Failed to reset settings:', err)
      setError('Failed to reset settings')
      throw err
    } finally {
      setSaving(false)
    }
  }, [updatePreferences])

  return {
    settings: preferences,
    loading,
    saving,
    error,
    updateSetting,
    updateSettings,
    resetToDefaults
  }
}

/**
 * Hook for accessing just the dashboard KPI settings
 */
export function useDashboardKPIs() {
  const { settings, updateSetting, loading, saving } = useSettings()
  
  const kpiSettings = settings?.dashboardKPIs || {
    successRateMethod: 'health' as const,
    budgetMethod: 'spent' as const,
    resourceMethod: 'auto' as const,
    resourceFixedValue: 85
  }

  const updateKPIs = useCallback(async (updates: Partial<DashboardKPIs>) => {
    await updateSetting('dashboardKPIs', {
      ...kpiSettings,
      ...updates
    })
  }, [kpiSettings, updateSetting])

  return {
    kpiSettings,
    updateKPIs,
    loading,
    saving
  }
}

/**
 * Hook for accessing just the AI settings
 */
export function useAISettings() {
  const { settings, updateSetting, loading, saving } = useSettings()
  
  const aiSettings = settings?.aiSettings || {
    enableSuggestions: true,
    enablePredictiveText: true,
    enableAutoOptimization: false
  }

  const updateAISettings = useCallback(async (updates: Partial<AISettings>) => {
    await updateSetting('aiSettings', {
      ...aiSettings,
      ...updates
    })
  }, [aiSettings, updateSetting])

  return {
    aiSettings,
    updateAISettings,
    loading,
    saving
  }
}
