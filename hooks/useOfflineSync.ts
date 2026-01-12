/**
 * React Hook for Offline Synchronization
 * Provides easy integration with React components for offline sync
 * Requirements: 11.3
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  offlineSyncService, 
  MergeConflict, 
  SyncResult 
} from '../lib/offline/sync'
import { OfflineChange } from '../lib/sync/cross-device-sync'

export interface UseOfflineSyncReturn {
  // Sync status
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: Date | null
  
  // Queue management
  queueChange: (change: Omit<OfflineChange, 'id' | 'timestamp' | 'deviceId' | 'synced'>) => void
  processSyncQueue: () => Promise<SyncResult>
  
  // Statistics
  syncStats: {
    pendingChanges: number
    failedChanges: number
    totalQueues: number
    lastSyncAttempt?: Date
  }
  
  // Conflicts
  pendingConflicts: MergeConflict[]
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge', mergedData?: any) => Promise<void>
  
  // Utilities
  initialize: (userId: string) => Promise<void>
  cleanup: () => void
}

/**
 * Hook for offline synchronization
 */
export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncStats, setSyncStats] = useState<{
    pendingChanges: number
    failedChanges: number
    totalQueues: number
    lastSyncAttempt?: Date
  }>({
    pendingChanges: 0,
    failedChanges: 0,
    totalQueues: 0
  })
  const [pendingConflicts, setPendingConflicts] = useState<MergeConflict[]>([])
  
  const serviceRef = useRef(offlineSyncService)
  const isInitialized = useRef(false)

  // Initialize service
  const initialize = useCallback(async (userId: string) => {
    if (isInitialized.current) return
    
    try {
      await serviceRef.current.initialize(userId)
      isInitialized.current = true
      updateStats()
      updateConflicts()
    } catch (error) {
      console.error('Failed to initialize offline sync:', error)
    }
  }, [])

  // Update sync statistics
  const updateStats = useCallback(() => {
    const stats = serviceRef.current.getSyncStats()
    setSyncStats({
      pendingChanges: stats.pendingChanges,
      failedChanges: stats.failedChanges,
      totalQueues: stats.totalQueues,
      ...(stats.lastSyncAttempt && { lastSyncAttempt: stats.lastSyncAttempt })
    })
  }, [])

  // Update pending conflicts
  const updateConflicts = useCallback(() => {
    const conflicts = serviceRef.current.getPendingConflicts()
    setPendingConflicts(conflicts)
  }, [])

  // Queue a change for offline sync
  const queueChange = useCallback((change: Omit<OfflineChange, 'id' | 'timestamp' | 'deviceId' | 'synced'>) => {
    serviceRef.current.queueChange(change)
    updateStats()
  }, [updateStats])

  // Process sync queue manually
  const processSyncQueue = useCallback(async () => {
    try {
      setIsSyncing(true)
      const result = await serviceRef.current.processSyncQueue()
      setLastSyncTime(new Date())
      updateStats()
      updateConflicts()
      return result
    } catch (error) {
      console.error('Failed to process sync queue:', error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [updateStats, updateConflicts])

  // Resolve a conflict
  const resolveConflict = useCallback(async (
    conflictId: string, 
    resolution: 'local' | 'remote' | 'merge', 
    mergedData?: any
  ) => {
    try {
      setIsSyncing(true)
      await serviceRef.current.resolveConflict(conflictId, resolution, mergedData)
      updateStats()
      updateConflicts()
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [updateStats, updateConflicts])

  // Cleanup service
  const cleanup = useCallback(() => {
    serviceRef.current.cleanup()
  }, [])

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Auto-sync when coming back online
      if (isInitialized.current) {
        processSyncQueue()
      }
    }
    
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processSyncQueue])

  // Listen for sync results
  useEffect(() => {
    const handleSyncResult = (event: CustomEvent) => {
      const result = event.detail as SyncResult
      setLastSyncTime(new Date())
      updateStats()
      updateConflicts()
      
      // Trigger custom event for UI notifications
      if (result.conflicts.length > 0) {
        window.dispatchEvent(new CustomEvent('sync-conflicts-detected', {
          detail: result.conflicts
        }))
      }
    }
    
    window.addEventListener('offline-sync-result', handleSyncResult as EventListener)
    
    return () => {
      window.removeEventListener('offline-sync-result', handleSyncResult as EventListener)
    }
  }, [updateStats, updateConflicts])

  // Periodic stats update
  useEffect(() => {
    if (!isInitialized.current) return
    
    const interval = setInterval(() => {
      updateStats()
    }, 10000) // Update every 10 seconds
    
    return () => clearInterval(interval)
  }, [updateStats])

  return {
    isOnline,
    isSyncing,
    lastSyncTime,
    queueChange,
    processSyncQueue,
    syncStats,
    pendingConflicts,
    resolveConflict,
    initialize,
    cleanup
  }
}

/**
 * Hook for entity-specific offline operations
 */
export function useOfflineEntity(entity: string) {
  const { queueChange } = useOfflineSync()
  
  const create = useCallback((entityId: string, data: any) => {
    queueChange({
      type: 'create',
      entity,
      entityId,
      data
    })
  }, [entity, queueChange])
  
  const update = useCallback((entityId: string, data: any) => {
    queueChange({
      type: 'update',
      entity,
      entityId,
      data
    })
  }, [entity, queueChange])
  
  const remove = useCallback((entityId: string) => {
    queueChange({
      type: 'delete',
      entity,
      entityId,
      data: null
    })
  }, [entity, queueChange])
  
  return {
    create,
    update,
    remove
  }
}

/**
 * Hook for form data offline persistence
 */
export function useOfflineForm(formId: string) {
  const { queueChange } = useOfflineSync()
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isDirty, setIsDirty] = useState(false)
  
  // Load form data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`offline-form-${formId}`)
    if (stored) {
      try {
        const data = JSON.parse(stored)
        setFormData(data)
        setIsDirty(true)
      } catch (error) {
        console.error('Failed to load offline form data:', error)
      }
    }
  }, [formId])
  
  // Save form data to localStorage
  const saveFormData = useCallback((data: Record<string, any>) => {
    setFormData(data)
    setIsDirty(true)
    localStorage.setItem(`offline-form-${formId}`, JSON.stringify(data))
  }, [formId])
  
  // Submit form data for sync
  const submitForm = useCallback((finalData?: Record<string, any>) => {
    const dataToSubmit = finalData || formData
    
    queueChange({
      type: 'create',
      entity: 'form-submission',
      entityId: formId,
      data: {
        formId,
        data: dataToSubmit,
        submittedAt: new Date()
      }
    })
    
    // Clear offline data after queuing
    localStorage.removeItem(`offline-form-${formId}`)
    setFormData({})
    setIsDirty(false)
  }, [formId, formData, queueChange])
  
  // Clear form data
  const clearForm = useCallback(() => {
    localStorage.removeItem(`offline-form-${formId}`)
    setFormData({})
    setIsDirty(false)
  }, [formId])
  
  return {
    formData,
    isDirty,
    saveFormData,
    submitForm,
    clearForm
  }
}

/**
 * Hook for offline-aware data fetching
 */
export function useOfflineData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    cacheTime?: number // Cache time in milliseconds
    staleTime?: number // Stale time in milliseconds
  } = {}
) {
  const { isOnline } = useOfflineSync()
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  
  const { cacheTime = 5 * 60 * 1000, staleTime = 60 * 1000 } = options
  
  // Load cached data
  useEffect(() => {
    const cached = localStorage.getItem(`offline-data-${key}`)
    if (cached) {
      try {
        const { data: cachedData, timestamp } = JSON.parse(cached)
        const age = Date.now() - timestamp
        
        if (age < cacheTime) {
          setData(cachedData)
          setLastFetch(new Date(timestamp))
        }
      } catch (error) {
        console.error('Failed to load cached data:', error)
      }
    }
  }, [key, cacheTime])
  
  // Fetch data
  const fetchData = useCallback(async (force = false) => {
    if (!isOnline && !force) return
    
    // Check if data is still fresh
    if (!force && lastFetch && data) {
      const age = Date.now() - lastFetch.getTime()
      if (age < staleTime) return
    }
    
    try {
      setIsLoading(true)
      setError(null)
      
      const result = await fetcher()
      setData(result)
      setLastFetch(new Date())
      
      // Cache the result
      localStorage.setItem(`offline-data-${key}`, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }))
      
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [isOnline, lastFetch, data, staleTime, fetcher, key])
  
  // Auto-fetch when online
  useEffect(() => {
    if (isOnline && !data) {
      fetchData()
    }
  }, [isOnline, data, fetchData])
  
  return {
    data,
    isLoading,
    error,
    lastFetch,
    refetch: () => fetchData(true),
    isStale: lastFetch ? Date.now() - lastFetch.getTime() > staleTime : true
  }
}