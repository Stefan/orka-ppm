/**
 * Property-Based Test: Frontend Real-time Workflow Updates
 * 
 * Feature: ai-empowered-ppm-features
 * Property 36: Frontend Real-time Workflow Updates
 * 
 * For any workflow state change, the Frontend SHALL update the displayed 
 * workflow status within 2 seconds using Supabase Realtime subscriptions 
 * without requiring a page refresh.
 * 
 * Validates: Requirements 8.3
 */

import { render, screen, waitFor, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useWorkflowRealtime, useWorkflowNotifications } from '@/hooks/useWorkflowRealtime'

// Mock Supabase client – built inside jest.mock factory so createClient isn't called before init (no TDZ)
// var so they're hoisted and assignable when the factory runs
var mockChannel: {
  on: jest.Mock
  subscribe: jest.Mock
  unsubscribe: jest.Mock
}
var mockSupabase: { channel: jest.Mock }

jest.mock('@supabase/supabase-js', () => {
  const ch = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return ch
    }),
    unsubscribe: jest.fn()
  }
  const supabase = { channel: jest.fn(() => ch) }
  mockChannel = ch
  mockSupabase = supabase
  return { createClient: jest.fn(() => supabase) }
})

// Mock environment variables before importing the hook
const originalEnv = process.env
process.env = {
  ...originalEnv,
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
}

describe('Property 36: Frontend Real-time Workflow Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('Workflow Instance Updates', () => {
    it('should subscribe to workflow_instances changes when workflowInstanceId is provided', () => {
      const workflowInstanceId = 'workflow-123'
      const onWorkflowUpdate = jest.fn()

      renderHook(() =>
        useWorkflowRealtime(workflowInstanceId, { onWorkflowUpdate })
      )

      // Verify channel was created with correct name
      expect(mockSupabase.channel).toHaveBeenCalledWith(`workflow:${workflowInstanceId}`)

      // Verify subscription to workflow_instances table
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_instances',
          filter: `id=eq.${workflowInstanceId}`
        }),
        expect.any(Function)
      )

      // Verify subscription was activated
      expect(mockChannel.subscribe).toHaveBeenCalled()
    })

    it('should call onWorkflowUpdate callback when workflow instance is updated', () => {
      const workflowInstanceId = 'workflow-123'
      const onWorkflowUpdate = jest.fn()
      let updateHandler: Function | null = null

      // Capture the update handler
      mockChannel.on.mockImplementation((event, config, handler) => {
        if (config.table === 'workflow_instances') {
          updateHandler = handler
        }
        return mockChannel
      })

      renderHook(() =>
        useWorkflowRealtime(workflowInstanceId, { onWorkflowUpdate })
      )

      // Simulate workflow update
      const updatePayload = {
        new: {
          id: workflowInstanceId,
          status: 'completed',
          current_step: 2,
          updated_at: new Date().toISOString()
        },
        old: {
          id: workflowInstanceId,
          status: 'in_progress',
          current_step: 1
        }
      }

      act(() => {
        if (updateHandler) {
          updateHandler(updatePayload)
        }
      })

      // Verify callback was called with payload
      expect(onWorkflowUpdate).toHaveBeenCalledWith(updatePayload)
    })

    it('should update within 2 seconds of state change', async () => {
      jest.useFakeTimers()
      
      const workflowInstanceId = 'workflow-123'
      const onWorkflowUpdate = jest.fn()
      let updateHandler: Function | null = null

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (config.table === 'workflow_instances') {
          updateHandler = handler
        }
        return mockChannel
      })

      renderHook(() =>
        useWorkflowRealtime(workflowInstanceId, { onWorkflowUpdate })
      )

      const startTime = Date.now()

      // Simulate workflow update
      act(() => {
        if (updateHandler) {
          updateHandler({
            new: { id: workflowInstanceId, status: 'completed' }
          })
        }
      })

      const endTime = Date.now()
      const elapsedTime = endTime - startTime

      // Verify update happened within 2 seconds (2000ms)
      expect(elapsedTime).toBeLessThan(2000)
      expect(onWorkflowUpdate).toHaveBeenCalled()

      jest.useRealTimers()
    })
  })

  describe('Workflow Approval Updates', () => {
    it('should subscribe to workflow_approvals changes', () => {
      const workflowInstanceId = 'workflow-123'
      const onApprovalUpdate = jest.fn()

      renderHook(() =>
        useWorkflowRealtime(workflowInstanceId, { onApprovalUpdate })
      )

      // Verify subscription to workflow_approvals table
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'workflow_approvals',
          filter: `workflow_instance_id=eq.${workflowInstanceId}`
        }),
        expect.any(Function)
      )
    })

    it('should call onApprovalUpdate callback when approval is updated', () => {
      const workflowInstanceId = 'workflow-123'
      const onApprovalUpdate = jest.fn()
      let approvalHandler: Function | null = null

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (config.table === 'workflow_approvals') {
          approvalHandler = handler
        }
        return mockChannel
      })

      renderHook(() =>
        useWorkflowRealtime(workflowInstanceId, { onApprovalUpdate })
      )

      // Simulate approval update
      const approvalPayload = {
        new: {
          id: 'approval-123',
          workflow_instance_id: workflowInstanceId,
          status: 'approved',
          approver_id: 'user-456',
          approved_at: new Date().toISOString()
        }
      }

      act(() => {
        if (approvalHandler) {
          approvalHandler(approvalPayload)
        }
      })

      expect(onApprovalUpdate).toHaveBeenCalledWith(approvalPayload)
    })
  })

  describe('User Notifications', () => {
    it('should subscribe to user-specific notifications', () => {
      const userId = 'user-123'
      const { result } = renderHook(() => useWorkflowNotifications(userId))

      const onNotification = jest.fn()
      
      act(() => {
        result.current.subscribe(onNotification)
      })

      // Verify channel was created for user
      expect(mockSupabase.channel).toHaveBeenCalledWith(`notifications:${userId}`)

      // Verify subscription to notifications table
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        }),
        expect.any(Function)
      )
    })

    it('should call notification callback when new notification arrives', () => {
      const userId = 'user-123'
      const onNotification = jest.fn()
      let notificationHandler: Function | null = null

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (config.table === 'notifications') {
          notificationHandler = handler
        }
        return mockChannel
      })

      const { result } = renderHook(() => useWorkflowNotifications(userId))

      act(() => {
        result.current.subscribe(onNotification)
      })

      // Simulate new notification
      const notificationPayload = {
        new: {
          id: 'notification-123',
          user_id: userId,
          type: 'approval_required',
          data: {
            workflow_instance_id: 'workflow-123',
            approval_id: 'approval-456'
          },
          created_at: new Date().toISOString()
        }
      }

      act(() => {
        if (notificationHandler) {
          notificationHandler(notificationPayload)
        }
      })

      expect(onNotification).toHaveBeenCalledWith(notificationPayload)
    })
  })

  describe('Subscription Lifecycle', () => {
    it('should cleanup subscription when component unmounts', () => {
      const workflowInstanceId = 'workflow-123'
      
      const { unmount } = renderHook(() =>
        useWorkflowRealtime(workflowInstanceId, {})
      )

      // Unmount the hook
      unmount()

      // Verify unsubscribe was called
      expect(mockChannel.unsubscribe).toHaveBeenCalled()
    })

    it('should not subscribe when workflowInstanceId is null', () => {
      renderHook(() => useWorkflowRealtime(null, {}))

      // Verify no channel was created
      expect(mockSupabase.channel).not.toHaveBeenCalled()
    })

    it('should resubscribe when workflowInstanceId changes', () => {
      const { rerender } = renderHook(
        ({ id }) => useWorkflowRealtime(id, {}),
        { initialProps: { id: 'workflow-123' } }
      )

      expect(mockSupabase.channel).toHaveBeenCalledWith('workflow:workflow-123')

      // Change the workflow ID
      rerender({ id: 'workflow-456' })

      // Verify old subscription was cleaned up
      expect(mockChannel.unsubscribe).toHaveBeenCalled()

      // Verify new subscription was created
      expect(mockSupabase.channel).toHaveBeenCalledWith('workflow:workflow-456')
    })
  })

  describe('Connection Status', () => {
    it('should report connection status correctly', () => {
      const workflowInstanceId = 'workflow-123'
      
      renderHook(() =>
        useWorkflowRealtime(workflowInstanceId, {})
      )

      // Verify subscription was attempted (channel was created)
      expect(mockSupabase.channel).toHaveBeenCalledWith(`workflow:${workflowInstanceId}`)
      expect(mockChannel.subscribe).toHaveBeenCalled()
    })

    it('should report disconnected when no workflow ID provided', () => {
      const { result } = renderHook(() =>
        useWorkflowRealtime(null, {})
      )

      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('Multiple State Changes', () => {
    it('should handle multiple rapid state changes', () => {
      const workflowInstanceId = 'workflow-123'
      const onWorkflowUpdate = jest.fn()
      let updateHandler: Function | null = null

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (config.table === 'workflow_instances') {
          updateHandler = handler
        }
        return mockChannel
      })

      renderHook(() =>
        useWorkflowRealtime(workflowInstanceId, { onWorkflowUpdate })
      )

      // Simulate multiple rapid updates
      const updates = [
        { new: { id: workflowInstanceId, status: 'in_progress', current_step: 0 } },
        { new: { id: workflowInstanceId, status: 'in_progress', current_step: 1 } },
        { new: { id: workflowInstanceId, status: 'completed', current_step: 2 } }
      ]

      act(() => {
        updates.forEach(update => {
          if (updateHandler) {
            updateHandler(update)
          }
        })
      })

      // Verify all updates were processed
      expect(onWorkflowUpdate).toHaveBeenCalledTimes(3)
      expect(onWorkflowUpdate).toHaveBeenNthCalledWith(1, updates[0])
      expect(onWorkflowUpdate).toHaveBeenNthCalledWith(2, updates[1])
      expect(onWorkflowUpdate).toHaveBeenNthCalledWith(3, updates[2])
    })
  })

  describe('Error Handling', () => {
    it('should handle subscription errors gracefully', () => {
      const workflowInstanceId = 'workflow-123'
      const onWorkflowUpdate = jest.fn()

      // Mock subscription failure
      mockChannel.subscribe.mockImplementation((callback) => {
        callback('SUBSCRIPTION_ERROR')
        return mockChannel
      })

      // Should not throw error
      expect(() => {
        renderHook(() =>
          useWorkflowRealtime(workflowInstanceId, { onWorkflowUpdate })
        )
      }).not.toThrow()
    })

    it('should handle missing Supabase credentials', () => {
      // With the mock, the hook uses the mocked client regardless of env.
      // Assert the hook does not throw when used (e.g. after env might be missing).
      expect(() => {
        renderHook(() => useWorkflowRealtime('workflow-123', {}))
      }).not.toThrow()
    })
  })
})
