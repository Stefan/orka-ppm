/**
 * useMobilePMR Hook
 * 
 * Mobile-optimized hook for PMR editing with touch interactions and offline support
 * Handles mobile-specific features like touch gestures, offline editing, and responsive layouts
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useMediaQuery } from './useMediaQuery'
import { useOffline } from './useOffline'
import { useTouchGestures } from './useTouchGestures'
import { usePMRContext } from './usePMRContext'
import type { PMRReport, PMRSection } from '@/components/pmr/types'

export interface MobilePMRState {
  isMobile: boolean
  isTablet: boolean
  orientation: 'portrait' | 'landscape'
  viewMode: 'compact' | 'expanded'
  activePanel: 'editor' | 'insights' | 'collaboration' | null
  keyboardVisible: boolean
  offlineMode: boolean
  pendingChanges: number
}

export interface MobilePMRActions {
  setViewMode: (mode: 'compact' | 'expanded') => void
  setActivePanel: (panel: 'editor' | 'insights' | 'collaboration' | null) => void
  togglePanel: (panel: 'editor' | 'insights' | 'collaboration') => void
  saveOffline: (sectionId: string, content: any) => Promise<void>
  syncOfflineChanges: () => Promise<void>
  optimizeForMobile: () => void
}

export interface UseMobilePMROptions {
  reportId?: string
  autoSaveInterval?: number
  enableOfflineEditing?: boolean
  enableTouchGestures?: boolean
}

export function useMobilePMR(options: UseMobilePMROptions = {}) {
  const {
    reportId,
    autoSaveInterval = 5000,
    enableOfflineEditing = true,
    enableTouchGestures = true
  } = options

  // Media queries
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isPortrait = useMediaQuery('(orientation: portrait)')

  // PMR context
  const {
    state: pmrState,
    updateSection,
    hasUnsavedChanges,
    updateReport,
  } = usePMRContext()
  const saveReport = useCallback(async () => {
    if (pmrState.currentReport) await updateReport(pmrState.currentReport)
  }, [pmrState.currentReport, updateReport])

  // Offline support
  const {
    isOnline,
    queueRequest,
    cacheData,
    getCachedData,
    performBackgroundSync
  } = useOffline({
    enableBackgroundSync: enableOfflineEditing
  })

  // State
  const [viewMode, setViewMode] = useState<'compact' | 'expanded'>('compact')
  const [activePanel, setActivePanel] = useState<'editor' | 'insights' | 'collaboration' | null>('editor')
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [pendingOfflineChanges, setPendingOfflineChanges] = useState<Map<string, any>>(new Map())

  // Refs
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSaveTimeRef = useRef<Date>(new Date())

  /**
   * Detect keyboard visibility (mobile)
   */
  useEffect(() => {
    if (!isMobile) return

    const handleResize = () => {
      // On mobile, if viewport height decreases significantly, keyboard is likely visible
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      const windowHeight = window.innerHeight
      const heightDiff = windowHeight - viewportHeight

      setKeyboardVisible(heightDiff > 150) // Threshold for keyboard detection
    }

    window.visualViewport?.addEventListener('resize', handleResize)
    window.addEventListener('resize', handleResize)

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize)
      window.removeEventListener('resize', handleResize)
    }
  }, [isMobile])

  /**
   * Auto-save for mobile editing
   */
  useEffect(() => {
    if (!enableOfflineEditing || !hasUnsavedChanges) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        if (isOnline) {
          await saveReport()
        } else {
          // Save to offline storage
          if (reportId) {
            await cacheData(`pmr-report-${reportId}`, pmrState.currentReport)
          }
        }
        lastSaveTimeRef.current = new Date()
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    }, autoSaveInterval)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [
    hasUnsavedChanges,
    enableOfflineEditing,
    autoSaveInterval,
    isOnline,
    saveReport,
    reportId,
    pmrState.currentReport,
    cacheData
  ])

  /**
   * Load cached report when offline
   */
  useEffect(() => {
    if (!reportId || isOnline) return

    const loadCachedReport = async () => {
      try {
        const cached = await getCachedData(`pmr-report-${reportId}`)
        if (cached) {
          console.log('Loaded cached PMR report for offline editing')
        }
      } catch (error) {
        console.error('Failed to load cached report:', error)
      }
    }

    loadCachedReport()
  }, [reportId, isOnline, getCachedData])

  /**
   * Save section offline
   */
  const saveOffline = useCallback(async (sectionId: string, content: any) => {
    try {
      // Update local state
      setPendingOfflineChanges(prev => new Map(prev).set(sectionId, content))

      // Cache the change
      await cacheData(`pmr-section-${sectionId}`, {
        sectionId,
        content,
        timestamp: new Date().toISOString()
      })

      // Queue for sync when online
      if (!isOnline) {
        await queueRequest(`/api/reports/pmr/${reportId}/sections/${sectionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          metadata: {
            sectionId,
            reportId,
            savedOffline: true
          }
        })
      }
    } catch (error) {
      console.error('Failed to save offline:', error)
      throw error
    }
  }, [isOnline, reportId, cacheData, queueRequest])

  /**
   * Sync offline changes when back online
   */
  const syncOfflineChanges = useCallback(async () => {
    if (!isOnline || pendingOfflineChanges.size === 0) return

    try {
      // Trigger background sync
      await performBackgroundSync()

      // Clear pending changes after successful sync
      setPendingOfflineChanges(new Map())

      console.log('Successfully synced offline changes')
    } catch (error) {
      console.error('Failed to sync offline changes:', error)
      throw error
    }
  }, [isOnline, pendingOfflineChanges, performBackgroundSync])

  /**
   * Auto-sync when coming back online
   */
  useEffect(() => {
    if (isOnline && pendingOfflineChanges.size > 0) {
      syncOfflineChanges()
    }
  }, [isOnline, pendingOfflineChanges.size, syncOfflineChanges])

  /**
   * Toggle panel visibility
   */
  const togglePanel = useCallback((panel: 'editor' | 'insights' | 'collaboration') => {
    setActivePanel(prev => prev === panel ? null : panel)
  }, [])

  /**
   * Optimize layout for mobile
   */
  const optimizeForMobile = useCallback(() => {
    if (isMobile) {
      setViewMode('compact')
      setActivePanel('editor')
    } else if (isTablet) {
      setViewMode('expanded')
    }
  }, [isMobile, isTablet])

  /**
   * Apply mobile optimizations on mount and device change
   */
  useEffect(() => {
    optimizeForMobile()
  }, [optimizeForMobile])

  // State object
  const state: MobilePMRState = {
    isMobile,
    isTablet,
    orientation: isPortrait ? 'portrait' : 'landscape',
    viewMode,
    activePanel,
    keyboardVisible,
    offlineMode: !isOnline,
    pendingChanges: pendingOfflineChanges.size
  }

  // Actions object
  const actions: MobilePMRActions = {
    setViewMode,
    setActivePanel,
    togglePanel,
    saveOffline,
    syncOfflineChanges,
    optimizeForMobile
  }

  return {
    state,
    actions,
    isOnline,
    lastSaveTime: lastSaveTimeRef.current
  }
}

export default useMobilePMR
