/**
 * PMR Export Pipeline Tests
 * 
 * Tests for multi-format export functionality (PDF, Excel, PowerPoint, Word)
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { usePMRContext } from '../hooks/usePMRContext'
import { PMRProvider } from '../contexts/PMRContext'
import type { ExportFormat, ExportOptions } from '../components/pmr/types'

// Mock auth
jest.mock('../app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: { access_token: 'mock-token' },
    user: { id: 'user-123' }
  })
}))

global.fetch = jest.fn()

describe('PMR Export Pipeline', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PMRProvider>{children}</PMRProvider>
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('PDF Export', () => {
    it('should export PMR to PDF with default options', async () => {
      const mockExportJob = {
        export_job_id: 'job-pdf-1',
        status: 'processing',
        estimated_completion: new Date(Date.now() + 30000).toISOString(),
        download_url: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'pdf' as ExportFormat,
          template_id: 'template-standard',
          options: {
            include_charts: true,
            include_raw_data: false
          }
        })
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/export'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('pdf')
          })
        )
      })
    })

    it('should export PDF with custom branding', async () => {
      const mockExportJob = {
        export_job_id: 'job-pdf-2',
        status: 'completed',
        estimated_completion: new Date().toISOString(),
        download_url: 'https://storage.example.com/exports/report-branded.pdf'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      const exportOptions: ExportOptions = {
        include_charts: true,
        include_raw_data: false,
        branding: {
          logo_url: 'https://company.com/logo.png',
          color_scheme: 'corporate_blue',
          company_name: 'Acme Corp',
          footer_text: 'Confidential - Internal Use Only'
        },
        sections: ['executive_summary', 'ai_insights', 'charts', 'appendix']
      }

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'pdf' as ExportFormat,
          template_id: 'template-executive',
          options: exportOptions
        })
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('corporate_blue')
          })
        )
      })
    })

    it('should handle PDF export with large reports', async () => {
      const mockExportJob = {
        export_job_id: 'job-pdf-large',
        status: 'processing',
        estimated_completion: new Date(Date.now() + 120000).toISOString(),
        download_url: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('large-report-123', {
          format: 'pdf' as ExportFormat,
          template_id: 'template-detailed',
          options: {
            include_charts: true,
            include_raw_data: true,
            sections: Array.from({ length: 20 }, (_, i) => `section-${i}`)
          }
        })
      })

      await waitFor(() => {
        const exportJobs = result.current.state.exportJobs
        expect(exportJobs.length).toBeGreaterThan(0)
        expect(exportJobs[0].status).toBe('processing')
      })
    })
  })

  describe('Excel Export', () => {
    it('should export PMR to Excel with charts', async () => {
      const mockExportJob = {
        export_job_id: 'job-excel-1',
        status: 'processing',
        estimated_completion: new Date(Date.now() + 45000).toISOString(),
        download_url: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'excel' as ExportFormat,
          template_id: 'template-data-analysis',
          options: {
            include_charts: true,
            include_raw_data: true,
            chart_types: ['budget_variance', 'schedule_performance', 'risk_heatmap']
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

    it('should export Excel with multiple worksheets', async () => {
      const mockExportJob = {
        export_job_id: 'job-excel-2',
        status: 'completed',
        estimated_completion: new Date().toISOString(),
        download_url: 'https://storage.example.com/exports/report-multi.xlsx'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'excel' as ExportFormat,
          template_id: 'template-comprehensive',
          options: {
            include_charts: true,
            include_raw_data: true,
            worksheets: [
              { name: 'Summary', sections: ['executive_summary'] },
              { name: 'Budget', sections: ['budget_analysis'] },
              { name: 'Schedule', sections: ['schedule_analysis'] },
              { name: 'Raw Data', sections: ['data_tables'] }
            ]
          }
        })
      })

      await waitFor(() => {
        expect(result.current.state.exportJobs.length).toBeGreaterThan(0)
      })
    })
  })

  describe('PowerPoint Export', () => {
    it('should export PMR to PowerPoint slides', async () => {
      const mockExportJob = {
        export_job_id: 'job-ppt-1',
        status: 'processing',
        estimated_completion: new Date(Date.now() + 60000).toISOString(),
        download_url: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'slides' as ExportFormat,
          template_id: 'template-presentation',
          options: {
            include_charts: true,
            include_raw_data: false,
            slide_layout: 'executive',
            sections: ['executive_summary', 'key_metrics', 'ai_insights']
          }
        })
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/export'),
          expect.objectContaining({
            body: expect.stringContaining('slides')
          })
        )
      })
    })

    it('should export PowerPoint with custom theme', async () => {
      const mockExportJob = {
        export_job_id: 'job-ppt-2',
        status: 'completed',
        estimated_completion: new Date().toISOString(),
        download_url: 'https://storage.example.com/exports/report-themed.pptx'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'slides' as ExportFormat,
          template_id: 'template-executive',
          options: {
            include_charts: true,
            branding: {
              logo_url: 'https://company.com/logo.png',
              color_scheme: 'corporate_green',
              theme: 'modern'
            },
            slide_layout: 'executive'
          }
        })
      })

      await waitFor(() => {
        expect(result.current.state.exportJobs.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Word Export', () => {
    it('should export PMR to Word document', async () => {
      const mockExportJob = {
        export_job_id: 'job-word-1',
        status: 'processing',
        estimated_completion: new Date(Date.now() + 40000).toISOString(),
        download_url: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'word' as ExportFormat,
          template_id: 'template-document',
          options: {
            include_charts: true,
            include_raw_data: true,
            document_style: 'formal'
          }
        })
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/export'),
          expect.objectContaining({
            body: expect.stringContaining('word')
          })
        )
      })
    })
  })

  describe('Export Job Management', () => {
    it('should track export job status', async () => {
      const mockExportJob = {
        export_job_id: 'job-track-1',
        status: 'processing',
        estimated_completion: new Date(Date.now() + 30000).toISOString(),
        download_url: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'pdf' as ExportFormat,
          template_id: 'template-standard',
          options: {}
        })
      })

      await waitFor(() => {
        const jobs = result.current.state.exportJobs
        expect(jobs.length).toBeGreaterThan(0)
        expect(jobs[0].export_job_id).toBe('job-track-1')
        expect(jobs[0].status).toBe('processing')
      })
    })

    it('should handle completed export jobs', async () => {
      const mockExportJob = {
        export_job_id: 'job-complete-1',
        status: 'completed',
        estimated_completion: new Date().toISOString(),
        download_url: 'https://storage.example.com/exports/report.pdf'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'pdf' as ExportFormat,
          template_id: 'template-standard',
          options: {}
        })
      })

      await waitFor(() => {
        const jobs = result.current.state.exportJobs
        const completedJob = jobs.find(j => j.export_job_id === 'job-complete-1')
        expect(completedJob?.status).toBe('completed')
        expect(completedJob?.download_url).toBeTruthy()
      })
    })

    it('should handle failed export jobs', async () => {
      const mockExportJob = {
        export_job_id: 'job-failed-1',
        status: 'failed',
        estimated_completion: new Date().toISOString(),
        download_url: null,
        error: 'Export generation failed'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportJob
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'pdf' as ExportFormat,
          template_id: 'template-standard',
          options: {}
        })
      })

      await waitFor(() => {
        const jobs = result.current.state.exportJobs
        const failedJob = jobs.find(j => j.export_job_id === 'job-failed-1')
        expect(failedJob?.status).toBe('failed')
      })
    })
  })

  describe('Export Error Handling', () => {
    it('should handle network errors during export', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'pdf' as ExportFormat,
          template_id: 'template-standard',
          options: {}
        })
      })

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy()
      })
    })

    it('should handle invalid export format', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid export format' })
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'invalid' as ExportFormat,
          template_id: 'template-standard',
          options: {}
        })
      })

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy()
      })
    })

    it('should handle missing template errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Template not found' })
      })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await result.current.actions.exportReport('report-123', {
          format: 'pdf' as ExportFormat,
          template_id: 'non-existent-template',
          options: {}
        })
      })

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy()
      })
    })
  })

  describe('Export Performance', () => {
    it('should handle concurrent export requests', async () => {
      const mockJobs = [
        {
          export_job_id: 'job-concurrent-1',
          status: 'processing',
          estimated_completion: new Date(Date.now() + 30000).toISOString(),
          download_url: null
        },
        {
          export_job_id: 'job-concurrent-2',
          status: 'processing',
          estimated_completion: new Date(Date.now() + 35000).toISOString(),
          download_url: null
        }
      ]

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockJobs[0]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockJobs[1]
        })

      const { result } = renderHook(() => usePMRContext(), { wrapper })

      await act(async () => {
        await Promise.all([
          result.current.actions.exportReport('report-123', {
            format: 'pdf' as ExportFormat,
            template_id: 'template-1',
            options: {}
          }),
          result.current.actions.exportReport('report-123', {
            format: 'excel' as ExportFormat,
            template_id: 'template-2',
            options: {}
          })
        ])
      })

      await waitFor(() => {
        expect(result.current.state.exportJobs.length).toBe(2)
      })
    })
  })
})
