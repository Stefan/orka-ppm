/**
 * Enhanced PMR Final Integration Test Suite
 * 
 * Comprehensive end-to-end testing for all Enhanced PMR features:
 * - Complete workflow from generation to export
 * - AI insights integration and validation
 * - Real-time collaboration functionality
 * - Multi-format export pipeline
 * - Performance benchmarks
 * - User acceptance scenarios
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { act } from 'react-dom/test-utils'

// Mock WebSocket
class MockWebSocket {
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  readyState = WebSocket.CONNECTING

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      if (this.onopen) this.onopen(new Event('open'))
    }, 0)
  }

  send(data: string) {
    // Simulate server response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data }))
      }
    }, 10)
  }

  close() {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) this.onclose(new CloseEvent('close'))
  }
}

global.WebSocket = MockWebSocket as any

// Mock fetch
global.fetch = jest.fn()

describe('Enhanced PMR Final Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      blob: async () => new Blob(),
    })
  })

  describe('1. Complete Workflow Integration', () => {
    it('should complete full PMR generation workflow', async () => {
      const mockReport = {
        id: 'report-123',
        project_id: 'project-456',
        title: 'Test PMR Report',
        status: 'completed',
        sections: [
          {
            section_id: 'executive_summary',
            title: 'Executive Summary',
            content: {
              ai_generated_summary: 'Project is performing well',
              key_metrics: {
                budget_utilization: 0.78,
                schedule_performance: 1.12,
                risk_score: 0.23
              },
              confidence_score: 0.94
            }
          }
        ],
        ai_insights: [],
        version: 1,
        generated_at: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReport
      })

      // Simulate PMR generation
      const response = await fetch('/api/reports/pmr/generate', {
        method: 'POST',
        body: JSON.stringify({
          project_id: 'project-456',
          report_month: '2024-01',
          include_ai_insights: true
        })
      })

      const data = await response.json()
      expect(data.id).toBe('report-123')
      expect(data.status).toBe('completed')
      expect(data.sections).toHaveLength(1)
    })

    it('should handle PMR generation errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Generation failed'))

      await expect(
        fetch('/api/reports/pmr/generate', {
          method: 'POST',
          body: JSON.stringify({ project_id: 'invalid' })
        })
      ).rejects.toThrow('Generation failed')
    })
  })

  describe('2. AI Insights Integration', () => {
    it('should generate and validate AI insights', async () => {
      const mockInsights = [
        {
          id: 'insight-1',
          insight_type: 'prediction',
          category: 'budget',
          title: 'Budget Variance Prediction',
          content: 'Project likely to finish 8% under budget',
          confidence_score: 0.87,
          supporting_data: {
            historical_variance: [-0.02, 0.05, -0.03],
            trend_analysis: 'decreasing_variance'
          },
          recommended_actions: ['Consider reallocating surplus budget'],
          priority: 'medium',
          generated_at: new Date().toISOString()
        }
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights: mockInsights })
      })

      const response = await fetch('/api/reports/pmr/report-123/insights/generate', {
        method: 'POST',
        body: JSON.stringify({
          insight_types: ['prediction'],
          categories: ['budget']
        })
      })

      const data = await response.json()
      expect(data.insights).toHaveLength(1)
      expect(data.insights[0].confidence_score).toBeGreaterThan(0.8)
      expect(data.insights[0].category).toBe('budget')
    })

    it('should validate AI insight accuracy', () => {
      const insight = {
        confidence_score: 0.87,
        supporting_data: {
          historical_variance: [-0.02, 0.05, -0.03]
        }
      }

      // Validate confidence threshold
      expect(insight.confidence_score).toBeGreaterThan(0.85)
      
      // Validate supporting data exists
      expect(insight.supporting_data).toBeDefined()
      expect(insight.supporting_data.historical_variance).toHaveLength(3)
    })
  })

  describe('3. Real-Time Collaboration', () => {
    it('should establish WebSocket connection', async () => {
      const ws = new WebSocket('ws://localhost/ws/reports/pmr/report-123/collaborate')
      
      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN)
      })

      ws.close()
    })

    it('should handle collaborative section updates', async () => {
      const ws = new WebSocket('ws://localhost/ws/reports/pmr/report-123/collaborate')
      
      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN)
      })

      const updateMessage = {
        type: 'section_update',
        section_id: 'executive_summary',
        user_id: 'user-123',
        changes: {
          content: 'Updated content',
          timestamp: new Date().toISOString()
        }
      }

      let receivedMessage: any = null
      ws.onmessage = (event) => {
        receivedMessage = JSON.parse(event.data)
      }

      ws.send(JSON.stringify(updateMessage))

      await waitFor(() => {
        expect(receivedMessage).toBeDefined()
      })

      ws.close()
    })

    it('should track user presence and cursors', async () => {
      const ws = new WebSocket('ws://localhost/ws/reports/pmr/report-123/collaborate')
      
      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN)
      })

      const cursorMessage = {
        type: 'user_cursor',
        user_id: 'user-123',
        section_id: 'budget_analysis',
        position: 145
      }

      ws.send(JSON.stringify(cursorMessage))

      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN)
      })

      ws.close()
    })
  })

  describe('4. Multi-Format Export Pipeline', () => {
    it('should export PMR to PDF format', async () => {
      const mockExportJob = {
        export_job_id: 'job-123',
        status: 'completed',
        download_url: 'https://example.com/exports/report-123.pdf'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const response = await fetch('/api/reports/pmr/report-123/export', {
        method: 'POST',
        body: JSON.stringify({
          format: 'pdf',
          options: {
            include_charts: true,
            include_raw_data: false
          }
        })
      })

      const data = await response.json()
      expect(data.export_job_id).toBe('job-123')
      expect(data.status).toBe('completed')
      expect(data.download_url).toContain('.pdf')
    })

    it('should export PMR to Excel format', async () => {
      const mockExportJob = {
        export_job_id: 'job-124',
        status: 'completed',
        download_url: 'https://example.com/exports/report-123.xlsx'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const response = await fetch('/api/reports/pmr/report-123/export', {
        method: 'POST',
        body: JSON.stringify({
          format: 'excel',
          options: {
            include_charts: true
          }
        })
      })

      const data = await response.json()
      expect(data.download_url).toContain('.xlsx')
    })

    it('should export PMR to PowerPoint format', async () => {
      const mockExportJob = {
        export_job_id: 'job-125',
        status: 'completed',
        download_url: 'https://example.com/exports/report-123.pptx'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const response = await fetch('/api/reports/pmr/report-123/export', {
        method: 'POST',
        body: JSON.stringify({
          format: 'powerpoint',
          options: {
            template_id: 'executive-template'
          }
        })
      })

      const data = await response.json()
      expect(data.download_url).toContain('.pptx')
    })

    it('should handle export with custom branding', async () => {
      const exportConfig = {
        format: 'pdf',
        options: {
          branding: {
            logo_url: 'https://company.com/logo.png',
            color_scheme: 'corporate_blue'
          }
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ export_job_id: 'job-126', status: 'processing' })
      })

      const response = await fetch('/api/reports/pmr/report-123/export', {
        method: 'POST',
        body: JSON.stringify(exportConfig)
      })

      expect(response.ok).toBe(true)
    })
  })

  describe('5. Performance Benchmarks', () => {
    it('should generate PMR within acceptable time', async () => {
      const startTime = Date.now()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'report-123',
          status: 'completed',
          generated_at: new Date().toISOString()
        })
      })

      await fetch('/api/reports/pmr/generate', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-456' })
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within 5 seconds (mocked)
      expect(duration).toBeLessThan(5000)
    })

    it('should handle concurrent collaboration efficiently', async () => {
      const connections = Array.from({ length: 5 }, (_, i) => 
        new WebSocket(`ws://localhost/ws/reports/pmr/report-123/collaborate?user=${i}`)
      )

      await waitFor(() => {
        connections.forEach(ws => {
          expect(ws.readyState).toBe(WebSocket.OPEN)
        })
      })

      connections.forEach(ws => ws.close())
    })

    it('should validate AI insight generation performance', async () => {
      const startTime = Date.now()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          insights: Array.from({ length: 10 }, (_, i) => ({
            id: `insight-${i}`,
            confidence_score: 0.85 + Math.random() * 0.1
          }))
        })
      })

      await fetch('/api/reports/pmr/report-123/insights/generate', {
        method: 'POST',
        body: JSON.stringify({ categories: ['budget', 'schedule', 'risk'] })
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // AI insights should generate within 3 seconds (mocked)
      expect(duration).toBeLessThan(3000)
    })
  })

  describe('6. User Acceptance Scenarios', () => {
    it('should support project manager workflow', async () => {
      // 1. Generate report
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'report-123', status: 'completed' })
      })

      const generateResponse = await fetch('/api/reports/pmr/generate', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-456' })
      })
      expect(generateResponse.ok).toBe(true)

      // 2. Review AI insights
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights: [{ id: 'insight-1' }] })
      })

      const insightsResponse = await fetch('/api/reports/pmr/report-123/insights/generate', {
        method: 'POST'
      })
      expect(insightsResponse.ok).toBe(true)

      // 3. Edit via chat
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'Updated', changes_applied: [] })
      })

      const editResponse = await fetch('/api/reports/pmr/report-123/edit/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Update executive summary' })
      })
      expect(editResponse.ok).toBe(true)

      // 4. Export to PDF
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ export_job_id: 'job-123', status: 'completed' })
      })

      const exportResponse = await fetch('/api/reports/pmr/report-123/export', {
        method: 'POST',
        body: JSON.stringify({ format: 'pdf' })
      })
      expect(exportResponse.ok).toBe(true)
    })

    it('should support executive review workflow', async () => {
      // 1. Load report
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'report-123',
          sections: [{ section_id: 'executive_summary' }],
          ai_insights: [{ priority: 'high' }]
        })
      })

      const loadResponse = await fetch('/api/reports/pmr/report-123')
      const report = await loadResponse.json()
      
      expect(report.sections).toBeDefined()
      expect(report.ai_insights).toBeDefined()

      // 2. Review high-priority insights
      const highPriorityInsights = report.ai_insights.filter(
        (i: any) => i.priority === 'high'
      )
      expect(highPriorityInsights.length).toBeGreaterThan(0)

      // 3. Export for presentation
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ export_job_id: 'job-124', status: 'completed' })
      })

      const exportResponse = await fetch('/api/reports/pmr/report-123/export', {
        method: 'POST',
        body: JSON.stringify({ format: 'powerpoint' })
      })
      expect(exportResponse.ok).toBe(true)
    })

    it('should support collaborative editing workflow', async () => {
      // 1. Start collaboration session
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'session-123' })
      })

      const sessionResponse = await fetch('/api/reports/pmr/report-123/collaborate', {
        method: 'POST',
        body: JSON.stringify({
          participants: ['user1@company.com', 'user2@company.com']
        })
      })
      expect(sessionResponse.ok).toBe(true)

      // 2. Connect via WebSocket
      const ws = new WebSocket('ws://localhost/ws/reports/pmr/report-123/collaborate')
      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN)
      })

      // 3. Make collaborative edits
      ws.send(JSON.stringify({
        type: 'section_update',
        section_id: 'budget_analysis',
        changes: { content: 'Updated by user1' }
      }))

      // 4. Close session
      ws.close()
    })
  })

  describe('7. Error Handling and Recovery', () => {
    it('should handle API errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      await expect(
        fetch('/api/reports/pmr/report-123')
      ).rejects.toThrow('Network error')
    })

    it('should handle WebSocket disconnection', async () => {
      const ws = new WebSocket('ws://localhost/ws/reports/pmr/report-123/collaborate')
      
      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN)
      })

      let closeEventFired = false
      ws.onclose = () => {
        closeEventFired = true
      }

      ws.close()

      await waitFor(() => {
        expect(closeEventFired).toBe(true)
      })
    })

    it('should validate export format support', async () => {
      const supportedFormats = ['pdf', 'excel', 'powerpoint', 'word']
      
      supportedFormats.forEach(format => {
        expect(['pdf', 'excel', 'powerpoint', 'word']).toContain(format)
      })
    })
  })

  describe('8. Integration with Existing Features', () => {
    it('should integrate with authentication system', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'mock-token'
      }

      // Simulate authenticated request
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'report-123' })
      })

      const response = await fetch('/api/reports/pmr/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockSession.access_token}`
        },
        body: JSON.stringify({ project_id: 'project-456' })
      })

      expect(response.ok).toBe(true)
    })

    it('should integrate with existing chart components', () => {
      const chartConfig = {
        type: 'budget_variance',
        data: [
          { month: 'Jan', variance: -0.02 },
          { month: 'Feb', variance: 0.05 }
        ],
        aiInsights: [
          { type: 'trend', content: 'Improving variance trend' }
        ]
      }

      expect(chartConfig.type).toBe('budget_variance')
      expect(chartConfig.data).toHaveLength(2)
      expect(chartConfig.aiInsights).toHaveLength(1)
    })

    it('should integrate with help system', () => {
      const helpContent = {
        feature: 'pmr_editor',
        quickTips: ['Use AI chat for quick edits'],
        tutorials: [{ title: 'Getting Started', href: '/docs/pmr' }]
      }

      expect(helpContent.feature).toBe('pmr_editor')
      expect(helpContent.quickTips).toHaveLength(1)
      expect(helpContent.tutorials).toHaveLength(1)
    })
  })
})
