/**
 * React Hook for Cross-Device Synchronization
 * Provides easy integration with React components
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  getCrossDeviceSyncService, 
  UserPreferences, 
  SessionState, 
  SyncConflict, 
  DeviceInfo,
  OfflineChange,
  SyncUnauthorizedError
} from '../lib/sync/cross-device-sync'

export interface UseCrossDeviceSyncReturn {
  // Preferences
  preferences: UserPreferences | null
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>
  
  // Session state
  sessionState: SessionState | null
  restoreSession: (deviceId?: string) => Promise<void>
  
  // Sync status
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: Date | null
  
  // Conflicts
  conflicts: SyncConflict[]
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge', mergedData?: any) => Promise<void>
  
  // Devices
  availableDevices: DeviceInfo[]
  refreshDevices: () => Promise<void>
  
  // Offline changes
  offlineChanges: OfflineChange[]
  hasOfflineChanges: boolean
  
  // Utilities
  initialize: (userId: string, accessToken?: string | null) => Promise<void>
  forceSync: () => Promise<void>
}

/**
 * Hook for cross-device synchronization
 */
export function useCrossDeviceSync(): UseCrossDeviceSyncReturn {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [availableDevices, setAvailableDevices] = useState<DeviceInfo[]>([])
  const [offlineChanges, setOfflineChanges] = useState<OfflineChange[]>([])
  
  const syncServiceRef = useRef(getCrossDeviceSyncService())
  const isInitialized = useRef(false)

  // Load preferences from localStorage (declared before initialize so it can be used there)
  const loadPreferences = useCallback(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return

    const stored = localStorage.getItem('user-preferences')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setPreferences({
          ...parsed,
          lastModified: new Date(parsed.lastModified)
        })
      } catch (error) {
        console.error('Failed to load preferences:', error)
      }
    }
  }, [])

  // Load conflicts from localStorage
  const loadConflicts = useCallback(() => {
    const syncConflicts = syncServiceRef.current.getSyncConflicts()
    setConflicts(syncConflicts)
  }, [])

  // Refresh available devices (declared before initialize so it can be used there)
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await syncServiceRef.current.getAvailableDevices()
      setAvailableDevices(devices)
    } catch (error) {
      const is401 = error instanceof SyncUnauthorizedError || (error && (error as Error).name === 'SyncUnauthorizedError')
      if (is401) {
        setAvailableDevices([])
        return
      }
      console.warn('Failed to refresh devices:', error instanceof Error ? error.message : error)
      setAvailableDevices([])
    }
  }, [])

  // Initialize sync service (pass accessToken so sync API requests are authenticated)
  const initialize = useCallback(async (userId: string, accessToken?: string | null) => {
    if (isInitialized.current || typeof window === 'undefined') return

    try {
      setIsSyncing(true)
      await syncServiceRef.current.initialize(userId, accessToken)
      isInitialized.current = true

      // Load initial data (local first; 401 on devices is non-fatal)
      loadPreferences()
      await refreshDevices()
      loadConflicts()

      setLastSyncTime(new Date())
    } catch (error) {
      const is401 = error instanceof SyncUnauthorizedError || (error && (error as Error).name === 'SyncUnauthorizedError')
      if (is401) {
        isInitialized.current = true
        loadPreferences()
        setAvailableDevices([])
      } else {
        console.error('Failed to initialize cross-device sync:', error)
      }
    } finally {
      setIsSyncing(false)
    }
  }, [loadPreferences, loadConflicts, refreshDevices])

  // Update preferences
  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    try {
      setIsSyncing(true)
      await syncServiceRef.current.updatePreferences(updates)
      loadPreferences() // Reload from localStorage
      setLastSyncTime(new Date())
    } catch (error) {
      // Don't re-throw: preferences are saved locally even when remote sync fails.
      // Re-throwing would break callers like theme switching.
      console.warn('Preferences sync failed (saved locally):', error instanceof Error ? error.message : error)
      loadPreferences() // Still reload local state
    } finally {
      setIsSyncing(false)
    }
  }, [loadPreferences])

  // Restore session state
  const restoreSession = useCallback(async (deviceId?: string) => {
    try {
      setIsSyncing(true)
      const restored = await syncServiceRef.current.restoreSessionState(deviceId)
      setSessionState(restored)
      setLastSyncTime(new Date())
    } catch (error) {
      console.error('Failed to restore session:', error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [])

  // Resolve sync conflict
  const resolveConflict = useCallback(async (
    conflictId: string, 
    resolution: 'local' | 'remote' | 'merge', 
    mergedData?: any
  ) => {
    try {
      setIsSyncing(true)
      await syncServiceRef.current.resolveSyncConflict(conflictId, resolution, mergedData)
      loadConflicts()
      loadPreferences()
      setLastSyncTime(new Date())
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [loadConflicts, loadPreferences])

  // Force sync
  const forceSync = useCallback(async () => {
    try {
      setIsSyncing(true)
      await syncServiceRef.current.syncPreferences()
      await syncServiceRef.current.syncSessionState()
      await syncServiceRef.current.syncOfflineChanges()
      
      loadPreferences()
      loadConflicts()
      setLastSyncTime(new Date())
    } catch (error) {
      console.error('Failed to force sync:', error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [loadPreferences, loadConflicts])

  // Monitor online status
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Listen for preference updates
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePreferencesUpdated = (event: CustomEvent) => {
      setPreferences(event.detail)
    }
    
    window.addEventListener('preferences-updated', handlePreferencesUpdated as EventListener)
    
    return () => {
      window.removeEventListener('preferences-updated', handlePreferencesUpdated as EventListener)
    }
  }, [])

  // Listen for sync conflicts
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleSyncConflict = (event: CustomEvent) => {
      setConflicts(prev => [...prev, event.detail])
    }
    
    window.addEventListener('sync-conflict', handleSyncConflict as EventListener)
    
    return () => {
      window.removeEventListener('sync-conflict', handleSyncConflict as EventListener)
    }
  }, [])

  // Load offline changes periodically
  useEffect(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
    
    const loadOfflineChanges = () => {
      const stored = localStorage.getItem('offline-changes')
      if (stored) {
        try {
          const changes = JSON.parse(stored).map((change: any) => ({
            ...change,
            timestamp: new Date(change.timestamp)
          }))
          setOfflineChanges(changes.filter((change: OfflineChange) => !change.synced))
        } catch (error) {
          console.error('Failed to load offline changes:', error)
        }
      }
    }
    
    loadOfflineChanges()
    
    // Check for offline changes every 10 seconds
    const interval = setInterval(loadOfflineChanges, 10000)
    
    return () => clearInterval(interval)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      syncServiceRef.current.cleanup()
    }
  }, [])

  return {
    preferences,
    updatePreferences,
    sessionState,
    restoreSession,
    isOnline,
    isSyncing,
    lastSyncTime,
    conflicts,
    resolveConflict,
    availableDevices,
    refreshDevices,
    offlineChanges,
    hasOfflineChanges: offlineChanges.length > 0,
    initialize,
    forceSync
  }
}

/**
 * Hook for device-specific preferences
 */
export function useDevicePreferences() {
  const { preferences, updatePreferences } = useCrossDeviceSync()
  const deviceId = localStorage.getItem('device-id') || 'unknown'
  
  const devicePrefs = preferences?.devicePreferences[deviceId] || {
    lastUsed: new Date(),
    preferredLayout: 'grid',
    customizations: {}
  }
  
  const updateDevicePreferences = useCallback(async (updates: any) => {
    if (!preferences) return
    
    const updatedDevicePrefs = {
      ...devicePrefs,
      ...updates,
      lastUsed: new Date()
    }
    
    await updatePreferences({
      devicePreferences: {
        ...preferences.devicePreferences,
        [deviceId]: updatedDevicePrefs
      }
    })
  }, [preferences, devicePrefs, deviceId, updatePreferences])
  
  return {
    devicePreferences: devicePrefs,
    updateDevicePreferences,
    deviceId
  }
}

/**
 * Hook for session continuity
 */
export function useSessionContinuity() {
  const { sessionState, restoreSession, availableDevices, refreshDevices } = useCrossDeviceSync()
  
  const getRecentDevices = useCallback(() => {
    return availableDevices
      .filter(device => device.isActive)
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, 5) // Get 5 most recent devices
  }, [availableDevices])
  
  const continueFromDevice = useCallback(async (deviceId: string) => {
    await restoreSession(deviceId)
  }, [restoreSession])
  
  return {
    sessionState,
    recentDevices: getRecentDevices(),
    continueFromDevice,
    refreshDevices
  }
}