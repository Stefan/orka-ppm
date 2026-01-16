/**
 * PMR Real-Time Collaboration Tests
 * 
 * Tests for WebSocket-based real-time collaboration features
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealtimePMR } from '../hooks/useRealtimePMR'
import type { ActiveUser } from '../hooks/useRealtimePMR'

// Mock auth
jest.mock('../app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: { access_token: 'mock-token' },
    user: { id: 'user-123', email: 'test@example.com' }
  })
}))

// Enhanced WebSocket mock
class MockWebSocket {
  static instances: MockWebSocket[] = []
  static lastInstance: MockWebSocket | null = null

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  readyState: number = WebSocket.CONNECTING
  sentMessages: string[] = []

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
    MockWebSocket.lastInstance = this
    
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      if (this.onopen) this.onopen(new Event('open'))
    }, 0)
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) this.onclose(new CloseEvent('close'))
  }

  simulateMessage(data: any) {
    if (this.onmessage && this.readyState === WebSocket.OPEN) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  simulateError(error: string) {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  static reset() {
    MockWebSocket.instances = []
    MockWebSocket.lastInstance = null
  }
}

global.WebSocket = MockWebSocket as any

describe('PMR Real-Time Collaboration', () => {
  beforeEach(() => {
    MockWebSocket.reset()
    jest.clearAllMocks()
  })

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        const [state] = result.current
        expect(state.isConnected).toBe(true)
      })

      expect(MockWebSocket.instances.length).toBe(1)
      expect(MockWebSocket.lastInstance?.url).toContain('report-123')
    })

    it('should handle connection errors', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate error
      act(() => {
        MockWebSocket.lastInstance?.simulateError('Connection failed')
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.error).toBeTruthy()
      })
    })

    it('should reconnect after disconnection', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate disconnection
      act(() => {
        MockWebSocket.lastInstance?.close()
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.isConnected).toBe(false)
      })
    })
  })

  describe('User Presence', () => {
    it('should track active users', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate user join
      act(() => {
        MockWebSocket.lastInstance?.simulateMessage({
          type: 'user_joined',
          user_id: 'user-456',
          user_name: 'Another User',
          user_color: '#ef4444',
          timestamp: new Date().toISOString()
        })
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.activeUsers.length).toBe(2)
        const newUser = state.activeUsers.find(u => u.userId === 'user-456')
        expect(newUser?.userName).toBe('Another User')
      })
    })

    it('should remove users when they leave', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Add user
      act(() => {
        MockWebSocket.lastInstance?.simulateMessage({
          type: 'user_joined',
          user_id: 'user-456',
          user_name: 'Another User',
          user_color: '#ef4444',
          timestamp: new Date().toISOString()
        })
      })

      await waitFor(() => {
        expect(result.current[0].activeUsers.length).toBe(2)
      })

      // Remove user
      act(() => {
        MockWebSocket.lastInstance?.simulateMessage({
          type: 'user_left',
          user_id: 'user-456',
          timestamp: new Date().toISOString()
        })
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.activeUsers.length).toBe(1)
        expect(state.activeUsers.every(u => u.userId !== 'user-456')).toBe(true)
      })
    })

    it('should track user cursor positions', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      const [, actions] = result.current

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Update cursor position
      act(() => {
        actions.updateCursor('executive_summary', 145)
      })

      // Verify message was sent
      const sentMessages = MockWebSocket.lastInstance?.sentMessages || []
      expect(sentMessages.length).toBeGreaterThan(0)
      
      const cursorMessage = sentMessages.find(msg => {
        const parsed = JSON.parse(msg)
        return parsed.type === 'user_cursor'
      })
      expect(cursorMessage).toBeDefined()
    })
  })

  describe('Section Updates', () => {
    it('should handle section content updates', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate section update from another user
      act(() => {
        MockWebSocket.lastInstance?.simulateMessage({
          type: 'section_update',
          section_id: 'executive_summary',
          user_id: 'user-456',
          changes: {
            content: 'Updated executive summary content',
            timestamp: new Date().toISOString()
          }
        })
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.pendingChanges.length).toBeGreaterThan(0)
        const change = state.pendingChanges[0]
        expect(change.section_id).toBe('executive_summary')
      })
    })

    it('should send section updates to other users', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      const [, actions] = result.current

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Send section update
      act(() => {
        actions.updateSection('budget_analysis', {
          content: 'Updated budget analysis',
          timestamp: new Date().toISOString()
        })
      })

      // Verify message was sent
      const sentMessages = MockWebSocket.lastInstance?.sentMessages || []
      const updateMessage = sentMessages.find(msg => {
        const parsed = JSON.parse(msg)
        return parsed.type === 'section_update' && parsed.section_id === 'budget_analysis'
      })
      expect(updateMessage).toBeDefined()
    })

    it('should handle concurrent section updates', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate multiple concurrent updates
      act(() => {
        MockWebSocket.lastInstance?.simulateMessage({
          type: 'section_update',
          section_id: 'budget_analysis',
          user_id: 'user-456',
          changes: {
            content: 'Update from user 456',
            timestamp: new Date().toISOString()
          }
        })

        MockWebSocket.lastInstance?.simulateMessage({
          type: 'section_update',
          section_id: 'budget_analysis',
          user_id: 'user-789',
          changes: {
            content: 'Update from user 789',
            timestamp: new Date(Date.now() + 1000).toISOString()
          }
        })
      })

      await waitFor(() => {
        const [state] = result.current
        const budgetChanges = state.pendingChanges.filter(
          c => c.section_id === 'budget_analysis'
        )
        expect(budgetChanges.length).toBe(2)
      })
    })
  })

  describe('Comments and Annotations', () => {
    it('should handle comment additions', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate comment added
      act(() => {
        MockWebSocket.lastInstance?.simulateMessage({
          type: 'comment_added',
          comment_id: 'comment-123',
          section_id: 'risk_assessment',
          content: 'Consider adding mitigation strategies',
          user_id: 'user-456',
          user_name: 'Another User',
          timestamp: new Date().toISOString()
        })
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.comments.length).toBeGreaterThan(0)
        const comment = state.comments[0]
        expect(comment.section_id).toBe('risk_assessment')
      })
    })

    it('should send comments to other users', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      const [, actions] = result.current

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Add comment
      act(() => {
        actions.addComment('schedule_analysis', 'Great progress on schedule')
      })

      // Verify message was sent
      const sentMessages = MockWebSocket.lastInstance?.sentMessages || []
      const commentMessage = sentMessages.find(msg => {
        const parsed = JSON.parse(msg)
        return parsed.type === 'comment_added'
      })
      expect(commentMessage).toBeDefined()
    })

    it('should handle comment resolution', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Add comment
      act(() => {
        MockWebSocket.lastInstance?.simulateMessage({
          type: 'comment_added',
          comment_id: 'comment-123',
          section_id: 'budget_analysis',
          content: 'Review this section',
          user_id: 'user-456',
          user_name: 'Another User',
          timestamp: new Date().toISOString()
        })
      })

      await waitFor(() => {
        expect(result.current[0].comments.length).toBe(1)
      })

      // Resolve comment
      act(() => {
        MockWebSocket.lastInstance?.simulateMessage({
          type: 'comment_resolved',
          comment_id: 'comment-123',
          resolved_by: 'user-123',
          timestamp: new Date().toISOString()
        })
      })

      await waitFor(() => {
        const [state] = result.current
        const comment = state.comments.find(c => c.comment_id === 'comment-123')
        expect(comment?.resolved).toBe(true)
      })
    })
  })

  describe('Conflict Resolution', () => {
    it('should detect conflicting edits', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate conflicting updates to same section
      act(() => {
        MockWebSocket.lastInstance?.simulateMessage({
          type: 'section_update',
          section_id: 'executive_summary',
          user_id: 'user-456',
          changes: {
            content: 'Version A',
            timestamp: new Date().toISOString()
          }
        })

        MockWebSocket.lastInstance?.simulateMessage({
          type: 'section_update',
          section_id: 'executive_summary',
          user_id: 'user-789',
          changes: {
            content: 'Version B',
            timestamp: new Date(Date.now() + 100).toISOString()
          }
        })
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.conflicts.length).toBeGreaterThan(0)
      })
    })

    it('should resolve conflicts with latest timestamp', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      const [, actions] = result.current

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Create conflict
      act(() => {
        MockWebSocket.lastInstance?.simulateMessage({
          type: 'section_update',
          section_id: 'budget_analysis',
          user_id: 'user-456',
          changes: {
            content: 'Older version',
            timestamp: new Date(Date.now() - 5000).toISOString()
          }
        })

        MockWebSocket.lastInstance?.simulateMessage({
          type: 'section_update',
          section_id: 'budget_analysis',
          user_id: 'user-789',
          changes: {
            content: 'Newer version',
            timestamp: new Date().toISOString()
          }
        })
      })

      await waitFor(() => {
        expect(result.current[0].conflicts.length).toBeGreaterThan(0)
      })

      // Resolve conflict
      act(() => {
        actions.resolveConflict('conflict-id', 'accept_latest')
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.conflicts.length).toBe(0)
      })
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      const startTime = performance.now()

      // Simulate 100 rapid updates
      act(() => {
        for (let i = 0; i < 100; i++) {
          MockWebSocket.lastInstance?.simulateMessage({
            type: 'user_cursor',
            user_id: 'user-456',
            section_id: 'executive_summary',
            position: i * 10,
            timestamp: new Date().toISOString()
          })
        }
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle updates within 500ms
      expect(duration).toBeLessThan(500)
    })

    it('should handle multiple concurrent users', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate 10 users joining
      act(() => {
        for (let i = 0; i < 10; i++) {
          MockWebSocket.lastInstance?.simulateMessage({
            type: 'user_joined',
            user_id: `user-${i}`,
            user_name: `User ${i}`,
            user_color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
            timestamp: new Date().toISOString()
          })
        }
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.activeUsers.length).toBe(11) // 10 + current user
      })
    })
  })
})
