/**
 * PMR Context Tests
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { PMRProvider, usePMRContext } from '../PMRContext'
import type { PMRReport, PMRGenerationRequest } from '@/components/pmr/types'

// Mock fetch
global.fetch = jest.fn()

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('PMRContext', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PMRProvider>{children}</PMRProvider>
  )

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => usePMRContext(), { wrapper })

      expect(result.current.state.currentReport).toBeNull()
      expect(result.current.state.isLoading).toBe(false)
      expect(result.current.state.isSaving).toBe(false)
      expect(result.current.state.error).toBeNull()
      expect(result.current.state.exportJobs).toEqual([])
      expect(result.current.state.pendingChanges.size).toBe(0)
    })
  })

  describe('Load Report', () => {
    it('should load report successfully', async () => {
      const mockReport: PMRReport = {
        id: 'report-1',
        project_id: 'project-1',
        title: 'Test Report',
        report_month: '2024-01',
        report_year: 2024,
        status: 'draft',
        sections: [],
        ai_insights: [],
        real_time_metrics: {},
        confidence_scores: {},
        template_customizations: {},
        generated_by: 'user-1',
        generated_at: '2024-01-01T00:00:00Z',
        last_modified: '2024-01-01T00:00:00Z',
        version: 1
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockReport
      } as Response)

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.loadReport('report-1')
      })

      await waitFor(() => {
        expect(result.current.state.currentReport).toEqual(mockReport)
        expect(result.current.state.isLoading).toBe(false)
      })
    })

    it('should handle load error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: async () => ({ message: 'Report not found' })
      } as Response)

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.loadReport('invalid-id')
      })

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy()
        expect(result.current.state.currentReport).toBeNull()
      })
    })
  })

  describe('Create Report', () => {
    it('should create report successfully', async () => {
      const request: PMRGenerationRequest = {
        project_id: 'project-1',
        report_month: '2024-01',
        report_year: 2024,
        template_id: 'template-1',
        title: 'New Report',
        include_ai_insights: true,
        include_monte_carlo: false
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'new-report-id', status: 'generating' })
      } as Response)

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      let reportId: string = ''
      await act(async () => {
        reportId = await result.current.actions.createReport(request)
      })

      expect(reportId).toBe('new-report-id')
    })
  })

  describe('Section Operations', () => {
    it('should update section optimistically', async () => {
      const mockReport: PMRReport = {
        id: 'report-1',
        project_id: 'project-1',
        title: 'Test Report',
        report_month: '2024-01',
        report_year: 2024,
        status: 'draft',
        sections: [
          {
            section_id: 'section-1',
            title: 'Executive Summary',
            content: { text: 'Original content' },
            ai_generated: false,
            last_modified: '2024-01-01T00:00:00Z',
            modified_by: 'user-1'
          }
        ],
        ai_insights: [],
        real_time_metrics: {},
        confidence_scores: {},
        template_customizations: {},
        generated_by: 'user-1',
        generated_at: '2024-01-01T00:00:00Z',
        last_modified: '2024-01-01T00:00:00Z',
        version: 1
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockReport
      } as Response)

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.loadReport('report-1')
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      } as Response)

      await act(async () => {
        await result.current.actions.updateSection('section-1', { text: 'Updated content' })
      })

      await waitFor(() => {
        const section = result.current.state.currentReport?.sections.find(
          s => s.section_id === 'section-1'
        )
        expect(section?.content).toEqual({ text: 'Updated content' })
      })
    })
  })

  describe('Error Handling', () => {
    it('should clear error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
        json: async () => ({ message: 'Test error' })
      } as Response)

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.loadReport('invalid-id')
      })

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy()
      })

      act(() => {
        result.current.actions.clearError()
      })

      expect(result.current.state.error).toBeNull()
    })
  })

  describe('Offline Support', () => {
    it('should queue changes when offline', async () => {
      const mockReport: PMRReport = {
        id: 'report-1',
        project_id: 'project-1',
        title: 'Test Report',
        report_month: '2024-01',
        report_year: 2024,
        status: 'draft',
        sections: [
          {
            section_id: 'section-1',
            title: 'Executive Summary',
            content: { text: 'Original content' },
            ai_generated: false,
            last_modified: '2024-01-01T00:00:00Z',
            modified_by: 'user-1'
          }
        ],
        ai_insights: [],
        real_time_metrics: {},
        confidence_scores: {},
        template_customizations: {},
        generated_by: 'user-1',
        generated_at: '2024-01-01T00:00:00Z',
        last_modified: '2024-01-01T00:00:00Z',
        version: 1
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockReport
      } as Response)

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.loadReport('report-1')
      })

      // Simulate going offline
      act(() => {
        window.dispatchEvent(new Event('offline'))
      })

      await act(async () => {
        await result.current.actions.updateSection('section-1', { text: 'Offline update' })
      })

      await waitFor(() => {
        expect(result.current.state.pendingChanges.size).toBe(1)
      })
    })
  })
})
