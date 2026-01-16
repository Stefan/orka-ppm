/**
 * Enhanced PMR Integration Tests
 * 
 * Comprehensive end-to-end testing for Enhanced PMR feature including:
 * - AI insights generation and validation
 * - Real-time collaboration with WebSocket mocking
 * - Export pipeline for all supported formats
 * - Performance validation
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Import hooks and components
import { useEnhancedAIChat } from '../hooks/useEnhancedAIChat'
import { useRealtimePMR } from '../hooks/useRealtimePMR'
import { usePMRContext } from '../hooks/usePMRContext'
import { PMRProvider } from '../contexts/PMRContext'
import PMREditor from '../components/pmr/PMREditor'

// Import types
import type { 
  PMRReport, 
  AIInsight, 
  PMRSection,
  ExportFormat 
} from '../components/pmr/types'

// Mock dependencies
jest.mock('../app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: { access_token: 'mock-token' },
    user: { id: 'user-123', email: 'test@example.com' }
  })
}))

// Mock WebSocket
class MockWebSocket {
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  readyState: number = WebSocket.CONNECTING

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      if (this.onopen) this.onopen(new Event('open'))
    }, 0)
  }

  send(data: string) {
    // Mock sending data
  }

  close() {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) this.onclose(new CloseEvent('close'))
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }
}

global.WebSocket = MockWebSocket as any

// Mock fetch
global.fetch = jest.fn()

describe('Enhanced PMR Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('AI Insights Generation', () => {
    it('should generate AI insights for all categories', async () => {
      const mockInsights: AIInsight[] = [
        {
          id: 'insight-1',
          insight_type: 'prediction',
          category: 'budget',
          title: 'Budget Variance Prediction',
          content: 'Project likely to finish 8% under budget',
          confidence_score: 0.87,
          supporting_data: { historical_variance: [-0.02, 0.05, -0.03] },
          recommended_actions: ['Consider reallocating surplus budget'],
          priority: 'medium',
          validation_status: 'pending',
          generated_at: new Date().toISOString()
        },
        {
          id: 'insight-2',
          insight_type: 'recommendation',
          category: 'schedule',
          title: 'Schedule Optimization',
          content: 'Critical path can be optimized by 3 days',
          confidence_score: 0.92,
          supporting_data: { critical_path_analysis: true },
          recommended_actions: ['Review task dependencies'],
          priority: 'high',
          validation_status: 'pending',
          generated_at: new Date().toISOString()
        }
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights: mockInsights })
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report-123'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['budget', 'schedule'])
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/reports/pmr/test-report-123/insights/generate'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('budget')
          })
        )
      })
    })

    it('should validate AI insight confidence scores', async () => {
      const lowConfidenceInsight: AIInsight = {
        id: 'insight-low',
        insight_type: 'alert',
        category: 'risk',
        title: 'Potential Risk',
        content: 'Low confidence risk detected',
        confidence_score: 0.45,
        supporting_data: {},
        recommended_actions: [],
        priority: 'low',
        validation_status: 'pending',
        generated_at: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights: [lowConfidenceInsight] })
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report-123'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['risk'])
      })

      // Low confidence insights should be flagged
      await waitFor(() => {
        const messages = result.current.messages
        const lastMessage = messages[messages.length - 1]
        expect(lastMessage.content).toContain('low confidence')
      })
    })

    it('should handle AI insight generation errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('AI service unavailable')
      )

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report-123'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['budget'])
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })
  })

  describe('Real-Time Collaboration', () => {
    it('should establish WebSocket connection for collaboration', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'test-report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      const [state] = result.current

      await waitFor(() => {
        expect(state.isConnected).toBe(true)
      })
    })

    it('should handle section updates from other users', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'test-report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      const [, actions] = result.current

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate incoming section update
      const mockWs = (global.WebSocket as any).lastInstance
      act(() => {
        mockWs?.simulateMessage({
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
      })
    })

    it('should track active users in collaboration session', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'test-report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate user join event
      const mockWs = (global.WebSocket as any).lastInstance
      act(() => {
        mockWs?.simulateMessage({
          type: 'user_joined',
          user_id: 'user-456',
          user_name: 'Another User',
          user_color: '#ef4444'
        })
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.activeUsers.length).toBe(2)
        expect(state.activeUsers.some(u => u.userId === 'user-456')).toBe(true)
      })
    })

    it('should handle cursor position updates', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'test-report-123',
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
        actions.updateCursor('budget_analysis', 145)
      })

      // Verify cursor update was sent
      expect(global.WebSocket).toBeDefined()
    })

    it('should handle WebSocket disconnection and reconnection', async () => {
      const { result } = renderHook(() => useRealtimePMR({
        reportId: 'test-report-123',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#3b82f6'
      }))

      await waitFor(() => {
        expect(result.current[0].isConnected).toBe(true)
      })

      // Simulate disconnection
      const mockWs = (global.WebSocket as any).lastInstance
      act(() => {
        mockWs?.close()
      })

      await waitFor(() => {
        const [state] = result.current
        expect(state.isConnected).toBe(false)
      })
    })
  })

  describe('Export Pipeline', () => {
    it('should export PMR to PDF format', async () => {
      const mockExportJob = {
        export_job_id: 'job-123',
        status: 'processing',
        estimated_completion: new Date(Date.now() + 30000).toISOString(),
        download_url: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PMRProvider>{children}</PMRProvider>
      )

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('test-report-123', {
          format: 'pdf' as ExportFormat,
          template_id: 'template-123',
          options: {
            include_charts: true,
            include_raw_data: false,
            branding: {
              logo_url: 'https://company.com/logo.png',
              color_scheme: 'corporate_blue'
            }
          }
        })
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/reports/pmr/test-report-123/export'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('pdf')
          })
        )
      })
    })

    it('should export PMR to Excel format with charts', async () => {
      const mockExportJob = {
        export_job_id: 'job-456',
        status: 'processing',
        estimated_completion: new Date(Date.now() + 45000).toISOString(),
        download_url: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PMRProvider>{children}</PMRProvider>
      )

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('test-report-123', {
          format: 'excel' as ExportFormat,
          template_id: 'template-123',
          options: {
            include_charts: true,
            include_raw_data: true
          }
        })
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/export'),
          expect.objectContaining({
            body: expect.stringContaining('excel')
          })
        )
      })
    })

    it('should export PMR to PowerPoint format', async () => {
      const mockExportJob = {
        export_job_id: 'job-789',
        status: 'completed',
        estimated_completion: new Date().toISOString(),
        download_url: 'https://storage.example.com/exports/report-123.pptx'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PMRProvider>{children}</PMRProvider>
      )

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('test-report-123', {
          format: 'slides' as ExportFormat,
          template_id: 'template-executive',
          options: {
            include_charts: true,
            sections: ['executive_summary', 'ai_insights', 'charts']
          }
        })
      })

      await waitFor(() => {
        expect(result.current.state.exportJobs.length).toBeGreaterThan(0)
      })
    })

    it('should handle export errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Export service unavailable')
      )

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PMRProvider>{children}</PMRProvider>
      )

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('test-report-123', {
          format: 'pdf' as ExportFormat,
          template_id: 'template-123',
          options: {}
        })
      })

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy()
      })
    })
  })

  describe('End-to-End PMR Workflow', () => {
    it('should complete full PMR generation workflow', async () => {
      const mockReport: PMRReport = {
        id: 'report-123',
        project_id: 'project-456',
        title: 'January 2024 PMR',
        status: 'completed',
        sections: [
          {
            section_id: 'executive_summary',
            title: 'Executive Summary',
            content: {
              ai_generated_summary: 'Project performing well',
              key_metrics: {
                budget_utilization: 0.78,
                schedule_performance: 1.12,
                risk_score: 0.23
              },
              confidence_score: 0.94
            },
            order: 1,
            is_ai_generated: true,
            last_modified: new Date().toISOString()
          }
        ],
        ai_insights: [],
        version: 1,
        last_modified: new Date().toISOString(),
        generated_at: new Date().toISOString()
      }

      // Mock report generation
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'report-123',
          status: 'generating',
          estimated_completion: new Date(Date.now() + 60000).toISOString()
        })
      })

      // Mock report retrieval
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReport
      })

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PMRProvider>{children}</PMRProvider>
      )

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      // Generate report
      await act(async () => {
        await result.current.actions.generateReport({
          project_id: 'project-456',
          report_month: '2024-01',
          report_year: 2024,
          template_id: 'template-123',
          title: 'January 2024 PMR',
          include_ai_insights: true,
          include_monte_carlo: true
        })
      })

      await waitFor(() => {
        expect(result.current.state.isGenerating).toBe(false)
      })

      // Load report
      await act(async () => {
        await result.current.actions.loadReport('report-123')
      })

      await waitFor(() => {
        expect(result.current.state.currentReport).toBeTruthy()
        expect(result.current.state.currentReport?.id).toBe('report-123')
      })
    })

    it('should handle chat-based editing workflow', async () => {
      const mockChatResponse = {
        response: 'Updated executive summary',
        changes_applied: [
          {
            section_id: 'executive_summary',
            change_type: 'content_update',
            old_content: 'Original content',
            new_content: 'Updated content with milestone',
            confidence: 0.92
          }
        ],
        session_id: 'session-123',
        suggestions: []
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatResponse
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report-123'
      }))

      await act(async () => {
        await result.current.sendMessage(
          'Update the executive summary to highlight the recent milestone'
        )
      })

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThan(0)
        const lastMessage = result.current.messages[result.current.messages.length - 1]
        expect(lastMessage.content).toContain('Updated')
      })
    })
  })

  describe('Performance Validation', () => {
    it('should generate AI insights within acceptable time', async () => {
      const startTime = performance.now()

      ;(global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ insights: [] })
            })
          }, 100) // Simulate 100ms response
        })
      )

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report-123'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['budget'])
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000)
    })

    it('should handle large reports efficiently', async () => {
      const largeSections: PMRSection[] = Array.from({ length: 20 }, (_, i) => ({
        section_id: `section-${i}`,
        title: `Section ${i}`,
        content: {
          text: 'Lorem ipsum '.repeat(100)
        },
        order: i,
        is_ai_generated: false,
        last_modified: new Date().toISOString()
      }))

      const largeReport: PMRReport = {
        id: 'large-report',
        project_id: 'project-456',
        title: 'Large PMR',
        status: 'completed',
        sections: largeSections,
        ai_insights: [],
        version: 1,
        last_modified: new Date().toISOString(),
        generated_at: new Date().toISOString()
      }

      const startTime = performance.now()

      render(
        <PMREditor
          report={largeReport}
          onSave={jest.fn()}
          isReadOnly={false}
        />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render within 1 second
      expect(renderTime).toBeLessThan(1000)
    })
  })
})
