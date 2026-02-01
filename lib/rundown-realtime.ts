// Rundown Profiles Real-Time Updates
// Handles real-time synchronization of rundown profiles

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { rundownKeys } from './rundown-queries'
import { RundownProfile } from '@/types/rundown'

// Configuration
const DEBOUNCE_MS = 2000 // 2-second debounce for rapid changes
const RECONNECT_DELAY_MS = 5000 // 5-second delay before reconnect attempt
const MAX_RECONNECT_ATTEMPTS = 5

/**
 * Real-time subscription status
 */
export type SubscriptionStatus = 
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

/**
 * Real-time event types
 */
export type RealtimeEventType = 
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'

/**
 * Real-time event payload
 */
export interface RealtimeEvent {
  type: RealtimeEventType
  table: string
  record?: RundownProfile
  old_record?: RundownProfile
  timestamp: string
}

/**
 * Hook state for real-time updates
 */
export interface UseRealtimeState {
  status: SubscriptionStatus
  lastEvent?: RealtimeEvent
  lastUpdate?: string
  isRefreshing: boolean
  error?: string
}

/**
 * Debounce function
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      func(...args)
      timeout = null
    }, wait)
  }
}

/**
 * Hook to subscribe to real-time rundown profile updates
 */
export function useRundownRealtime(
  projectId?: string,
  options?: {
    enabled?: boolean
    debounceMs?: number
    onEvent?: (event: RealtimeEvent) => void
  }
): UseRealtimeState {
  const { 
    enabled = true, 
    debounceMs = DEBOUNCE_MS,
    onEvent 
  } = options || {}
  
  const queryClient = useQueryClient()
  const [state, setState] = useState<UseRealtimeState>({
    status: 'disconnected',
    isRefreshing: false
  })
  
  // Track reconnect attempts
  const reconnectAttempts = useRef(0)
  const channelRef = useRef<any>(null)
  
  // Debounced invalidation function
  const invalidateQueries = useCallback(
    debounce((pId: string) => {
      setState(prev => ({ ...prev, isRefreshing: true }))
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: pId ? rundownKeys.profiles(pId) : rundownKeys.all
      })
      
      // Reset refreshing state after a short delay
      setTimeout(() => {
        setState(prev => ({ ...prev, isRefreshing: false }))
      }, 500)
    }, debounceMs),
    [queryClient, debounceMs]
  )
  
  // Handle incoming events
  const handleEvent = useCallback((payload: any) => {
    const event: RealtimeEvent = {
      type: payload.eventType || payload.type,
      table: payload.table,
      record: payload.new,
      old_record: payload.old,
      timestamp: new Date().toISOString()
    }
    
    setState(prev => ({
      ...prev,
      lastEvent: event,
      lastUpdate: event.timestamp
    }))
    
    // Call custom event handler
    if (onEvent) {
      onEvent(event)
    }
    
    // Trigger debounced query invalidation
    const affectedProjectId = event.record?.project_id || event.old_record?.project_id
    if (affectedProjectId) {
      invalidateQueries(affectedProjectId)
    }
  }, [onEvent, invalidateQueries])
  
  useEffect(() => {
    if (!enabled) {
      setState(prev => ({ ...prev, status: 'disconnected' }))
      return
    }
    
    // This is a mock implementation since actual Supabase realtime 
    // requires the supabase client setup
    // In production, this would use supabase.channel() for real-time subscriptions
    
    const mockSubscribe = () => {
      setState(prev => ({ ...prev, status: 'connecting' }))
      
      // Simulate connection
      setTimeout(() => {
        setState(prev => ({ ...prev, status: 'connected' }))
        reconnectAttempts.current = 0
      }, 500)
    }
    
    mockSubscribe()
    
    return () => {
      // Cleanup subscription
      if (channelRef.current) {
        // channelRef.current.unsubscribe()
      }
      setState(prev => ({ ...prev, status: 'disconnected' }))
    }
  }, [enabled, projectId])
  
  return state
}

/**
 * Hook to manage refresh state with visual indicator
 */
export function useRefreshIndicator() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  
  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true)
    setLastRefresh(new Date())
    
    // Auto-reset after animation
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }, [])
  
  const formatLastRefresh = useCallback(() => {
    if (!lastRefresh) return null
    
    const now = new Date()
    const diff = now.getTime() - lastRefresh.getTime()
    
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return lastRefresh.toLocaleTimeString()
  }, [lastRefresh])
  
  return {
    isRefreshing,
    lastRefresh,
    triggerRefresh,
    formatLastRefresh
  }
}

/**
 * Component props for refresh indicator
 */
export interface RefreshIndicatorProps {
  isRefreshing: boolean
  lastUpdate?: string
  onClick?: () => void
  className?: string
}

/**
 * Visual refresh indicator (use in components)
 */
export function getRefreshIndicatorClasses(isRefreshing: boolean): string {
  return isRefreshing 
    ? 'animate-pulse bg-blue-100 border-blue-300'
    : 'bg-transparent border-transparent'
}

/**
 * Format timestamp for display
 */
export function formatUpdateTime(timestamp: string | undefined): string {
  if (!timestamp) return 'Never'
  
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  
  if (diffMs < 60000) return 'Just now'
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`
  
  return date.toLocaleDateString()
}

/**
 * Create a subscription to profile changes for a project
 * This would be called with the Supabase client in actual implementation
 */
export function createProfileSubscription(
  supabaseClient: any,
  projectId: string,
  onUpdate: (profile: RundownProfile) => void
) {
  // This is a placeholder for actual Supabase subscription
  // In production:
  /*
  const channel = supabaseClient
    .channel(`rundown-${projectId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rundown_profiles',
        filter: `project_id=eq.${projectId}`
      },
      (payload: any) => {
        if (payload.new) {
          onUpdate(payload.new as RundownProfile)
        }
      }
    )
    .subscribe()
  
  return () => channel.unsubscribe()
  */
  
  // Mock implementation
  return () => {}
}

export default useRundownRealtime
