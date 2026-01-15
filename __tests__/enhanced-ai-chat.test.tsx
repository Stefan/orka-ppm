/**
 * Tests for Enhanced AI Chat Integration
 * Validates PMR-specific chat functionality
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useEnhancedAIChat } from '../hooks/useEnhancedAIChat'

// Mock the auth provider
jest.mock('../app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: {
      access_token: 'mock-token'
    }
  })
}))

// Mock fetch
global.fetch = jest.fn()

describe('useEnhancedAIChat', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useEnhancedAIChat())

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.pendingChanges).toEqual([])
  })

  it('should update context', () => {
    const { result } = renderHook(() => useEnhancedAIChat())

    act(() => {
      result.current.updateContext({
        reportId: 'test-report-123',
        projectId: 'test-project-456'
      })
    })

    expect(result.current.context.reportId).toBe('test-report-123')
    expect(result.current.context.projectId).toBe('test-project-456')
  })

  it('should send message with PMR context', async () => {
    const mockResponse = {
      response: 'Test response',
      confidence: 0.95,
      sessionId: 'session-123',
      sources: []
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const { result } = renderHook(() => useEnhancedAIChat({
      reportId: 'test-report'
    }))

    await act(async () => {
      await result.current.sendMessage('Test message')
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2) // user + assistant
      expect(result.current.messages[0].type).toBe('user')
      expect(result.current.messages[1].type).toBe('assistant')
      expect(result.current.messages[1].content).toBe('Test response')
    })
  })

  it('should handle suggested changes', async () => {
    const mockResponse = {
      response: 'Here are some suggestions',
      confidence: 0.9,
      sessionId: 'session-123',
      suggestedChanges: [
        {
          id: 'change-1',
          section: 'executive_summary',
          changeType: 'modify',
          content: 'Updated summary text',
          reason: 'More concise',
          confidence: 0.85,
          applied: false
        }
      ]
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const { result } = renderHook(() => useEnhancedAIChat())

    await act(async () => {
      await result.current.sendMessage('Suggest improvements')
    })

    await waitFor(() => {
      expect(result.current.pendingChanges.length).toBe(1)
      expect(result.current.pendingChanges[0].section).toBe('executive_summary')
      expect(result.current.hasPendingChanges).toBe(true)
    })
  })

  it('should apply suggested change', async () => {
    const mockResponse = {
      response: 'Suggestion provided',
      confidence: 0.9,
      sessionId: 'session-123',
      suggestedChanges: [
        {
          id: 'change-1',
          section: 'budget',
          changeType: 'add',
          content: 'New budget insight',
          reason: 'Missing analysis',
          confidence: 0.9,
          applied: false
        }
      ]
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const { result } = renderHook(() => useEnhancedAIChat())

    await act(async () => {
      await result.current.sendMessage('Add budget analysis')
    })

    await waitFor(() => {
      expect(result.current.pendingChanges.length).toBe(1)
    })

    act(() => {
      result.current.applySuggestedChange('change-1')
    })

    expect(result.current.pendingChanges[0].applied).toBe(true)
    expect(result.current.hasPendingChanges).toBe(false)
  })

  it('should reject suggested change', async () => {
    const mockResponse = {
      response: 'Suggestion provided',
      confidence: 0.9,
      sessionId: 'session-123',
      suggestedChanges: [
        {
          id: 'change-1',
          section: 'risks',
          changeType: 'remove',
          content: 'Remove outdated risk',
          reason: 'No longer relevant',
          confidence: 0.8,
          applied: false
        }
      ]
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const { result } = renderHook(() => useEnhancedAIChat())

    await act(async () => {
      await result.current.sendMessage('Review risks')
    })

    await waitFor(() => {
      expect(result.current.pendingChanges.length).toBe(1)
    })

    act(() => {
      result.current.rejectSuggestedChange('change-1')
    })

    expect(result.current.pendingChanges.length).toBe(0)
  })

  it('should use quick actions', async () => {
    const mockResponse = {
      response: 'Budget analysis complete',
      confidence: 0.95,
      sessionId: 'session-123',
      action: 'analyze_data'
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const { result } = renderHook(() => useEnhancedAIChat())

    await act(async () => {
      await result.current.quickActions.analyzeBudget()
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2)
      expect(result.current.messages[1].action).toBe('analyze_data')
    })
  })

  it('should handle errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    )

    const { result } = renderHook(() => useEnhancedAIChat())

    await act(async () => {
      await result.current.sendMessage('Test message')
    })

    await waitFor(() => {
      expect(result.current.error).toBe('Network error')
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('should clear messages', () => {
    const { result } = renderHook(() => useEnhancedAIChat())

    act(() => {
      result.current.updateContext({ reportId: 'test' })
    })

    act(() => {
      result.current.clearMessages()
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.sessionId).toBeNull()
    expect(result.current.pendingChanges).toEqual([])
  })

  it('should get pending changes for section', async () => {
    const mockResponse = {
      response: 'Multiple suggestions',
      confidence: 0.9,
      sessionId: 'session-123',
      suggestedChanges: [
        {
          id: 'change-1',
          section: 'budget',
          changeType: 'modify',
          content: 'Budget update 1',
          reason: 'Accuracy',
          confidence: 0.9,
          applied: false
        },
        {
          id: 'change-2',
          section: 'schedule',
          changeType: 'add',
          content: 'Schedule insight',
          reason: 'Missing data',
          confidence: 0.85,
          applied: false
        },
        {
          id: 'change-3',
          section: 'budget',
          changeType: 'add',
          content: 'Budget update 2',
          reason: 'Completeness',
          confidence: 0.88,
          applied: false
        }
      ]
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const { result } = renderHook(() => useEnhancedAIChat())

    await act(async () => {
      await result.current.sendMessage('Review all sections')
    })

    await waitFor(() => {
      const budgetChanges = result.current.getPendingChangesForSection('budget')
      expect(budgetChanges.length).toBe(2)
      expect(budgetChanges.every(c => c.section === 'budget')).toBe(true)
    })
  })
})
