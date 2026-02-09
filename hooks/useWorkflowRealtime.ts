'use client'

import { useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/api/supabase-minimal'

interface WorkflowRealtimeOptions {
  onWorkflowUpdate?: (payload: any) => void
  onApprovalUpdate?: (payload: any) => void
  onNotification?: (payload: any) => void
}

export function useWorkflowRealtime(
  workflowInstanceId: string | null,
  options: WorkflowRealtimeOptions = {}
) {
  const channelRef = useRef<any>(null)

  const { onWorkflowUpdate, onApprovalUpdate, onNotification } = options

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!workflowInstanceId) {
      cleanup()
      return
    }

    // Use shared singleton client to avoid multiple GoTrueClient instances (same storage key)

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
  const channelRef = useRef<any>(null)

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])

  const subscribe = useCallback((onNotification: (payload: any) => void) => {
    if (!userId) return

    // Use shared singleton client to avoid multiple GoTrueClient instances (same storage key)

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

  return useMemo(
    () => ({ subscribe, cleanup, isConnected: !!channelRef.current }),
    [subscribe, cleanup]
  )
}
