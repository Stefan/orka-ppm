'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// Allow environment variables to be overridden for testing
const getSupabaseConfig = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
})

interface WorkflowRealtimeOptions {
  onWorkflowUpdate?: (payload: any) => void
  onApprovalUpdate?: (payload: any) => void
  onNotification?: (payload: any) => void
}

export function useWorkflowRealtime(
  workflowInstanceId: string | null,
  options: WorkflowRealtimeOptions = {}
) {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const channelRef = useRef<any>(null)

  const { onWorkflowUpdate, onApprovalUpdate, onNotification } = options

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    const config = getSupabaseConfig()
    
    if (!config.url || !config.anonKey) {
      console.warn('Supabase credentials not configured')
      return
    }

    if (!workflowInstanceId) {
      cleanup()
      return
    }

    // Initialize Supabase client if not already done
    if (!supabaseRef.current) {
      supabaseRef.current = createClient(config.url, config.anonKey)
    }

    const supabase = supabaseRef.current

    // Subscribe to workflow_instances changes
    const channel = supabase
      .channel(`workflow:${workflowInstanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_instances',
          filter: `id=eq.${workflowInstanceId}`
        },
        (payload) => {
          console.log('Workflow instance updated:', payload)
          if (onWorkflowUpdate) {
            onWorkflowUpdate(payload)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_approvals',
          filter: `workflow_instance_id=eq.${workflowInstanceId}`
        },
        (payload) => {
          console.log('Workflow approval updated:', payload)
          if (onApprovalUpdate) {
            onApprovalUpdate(payload)
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status)
      })

    channelRef.current = channel

    return () => {
      cleanup()
    }
  }, [workflowInstanceId, onWorkflowUpdate, onApprovalUpdate, cleanup])

  return {
    isConnected: !!channelRef.current,
    cleanup
  }
}

// Hook for user-specific notifications
export function useWorkflowNotifications(userId: string | null) {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const channelRef = useRef<any>(null)

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])

  const subscribe = useCallback((onNotification: (payload: any) => void) => {
    const config = getSupabaseConfig()
    
    if (!config.url || !config.anonKey || !userId) {
      return
    }

    // Initialize Supabase client if not already done
    if (!supabaseRef.current) {
      supabaseRef.current = createClient(config.url, config.anonKey)
    }

    const supabase = supabaseRef.current

    // Subscribe to notifications for this user
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('New notification:', payload)
          onNotification(payload)
        }
      )
      .subscribe((status) => {
        console.log('Notifications subscription status:', status)
      })

    channelRef.current = channel
  }, [userId])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    subscribe,
    cleanup,
    isConnected: !!channelRef.current
  }
}
