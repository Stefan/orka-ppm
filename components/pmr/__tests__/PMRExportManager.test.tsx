/**
 * PMRExportManager Component Tests
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PMRExportManager } from '../PMRExportManager'
import { PMRReport, ExportJob } from '../types'

// Mock report data
const mockReport: PMRReport = {
  id: 'report-123',
  project_id: 'project-456',
  title: 'Test PMR Report',
  report_month: '2024-01',
  report_year: 2024,
  status: 'approved',
  sections: [
    {
      section_id: 'executive_summary',
      title: 'Executive Summary',
      content: 'Test content',
      ai_generated: true,
      confidence_score: 0.9,
      last_modified: '2024-01-10T10:00:00Z',
      modified_by: 'user-123'
    },
    {
      section_id: 'budget_analysis',
      title: 'Budget Analysis',
      content: 'Budget content',
      ai_generated: false,
      last_modified: '2024-01-10T10:00:00Z',
      modified_by: 'user-123'
    }
  ],
  ai_insights: [],
  real_time_metrics: {},
  confidence_scores: {},
  template_customizations: {},
  generated_by: 'user-123',
  generated_at: '2024-01-10T10:00:00Z',
  last_modified: '2024-01-10T10:00:00Z',
  version: 1
}

describe('PMRExportManager', () => {
  const mockOnExport = jest.fn()
  const mockOnDownload = jest.fn()
  const mockOnCancelExport = jest.fn()
  const mockOnDeleteExport = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the component with title', () => {
    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    expect(screen.getByText('Export Report')).toBeInTheDocument()
    expect(
      screen.getByText('Configure and export your PMR report in multiple formats')
    ).toBeInTheDocument()
  })

  it('displays all available export formats', () => {
    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    expect(screen.getByText('PDF Document')).toBeInTheDocument()
    expect(screen.getByText('Excel Spreadsheet')).toBeInTheDocument()
    expect(screen.getByText('PowerPoint Presentation')).toBeInTheDocument()
    expect(screen.getByText('Word Document')).toBeInTheDocument()
  })

  it('allows format selection', () => {
    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    const excelButton = screen.getByText('Excel Spreadsheet').closest('button')
    fireEvent.click(excelButton!)

    expect(excelButton).toHaveClass('border-blue-500')
  })

  it('displays report sections for selection', () => {
    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    expect(screen.getByText('Executive Summary')).toBeInTheDocument()
    expect(screen.getByText('Budget Analysis')).toBeInTheDocument()
  })

  it('allows section selection/deselection', () => {
    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    const checkbox = screen.getByLabelText('Executive Summary') as HTMLInputElement
    
    // Toggle off
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)

    // Toggle back on
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
  })

  it('handles export options', () => {
    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    const chartsCheckbox = screen.getByLabelText(
      'Include charts and visualizations'
    ) as HTMLInputElement
    const rawDataCheckbox = screen.getByLabelText(
      'Include raw data tables'
    ) as HTMLInputElement

    expect(chartsCheckbox.checked).toBe(true)
    expect(rawDataCheckbox.checked).toBe(false)

    fireEvent.click(chartsCheckbox)
    expect(chartsCheckbox.checked).toBe(false)

    fireEvent.click(rawDataCheckbox)
    expect(rawDataCheckbox.checked).toBe(true)
  })

  it('handles branding configuration', () => {
    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    const companyNameInput = screen.getByPlaceholderText(
      'Enter company name'
    ) as HTMLInputElement
    const logoUrlInput = screen.getByPlaceholderText(
      'https://example.com/logo.png'
    ) as HTMLInputElement

    fireEvent.change(companyNameInput, { target: { value: 'Acme Corp' } })
    fireEvent.change(logoUrlInput, {
      target: { value: 'https://acme.com/logo.png' }
    })

    expect(companyNameInput.value).toBe('Acme Corp')
    expect(logoUrlInput.value).toBe('https://acme.com/logo.png')
  })

  it('calls onExport with correct configuration', async () => {
    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    const exportButton = screen.getByText('Export as PDF Document')
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'pdf',
          options: expect.objectContaining({
            includeCharts: true,
            includeRawData: false
          })
        })
      )
    })
  })

  it('displays export queue', () => {
    const mockJobs: ExportJob[] = [
      {
        id: 'job-1',
        report_id: 'report-123',
        export_format: 'pdf',
        template_config: {},
        export_options: {},
        status: 'completed',
        file_url: '/downloads/job-1.pdf',
        file_size: 1024000,
        requested_by: 'user-123',
        started_at: '2024-01-10T10:00:00Z',
        completed_at: '2024-01-10T10:05:00Z'
      },
      {
        id: 'job-2',
        report_id: 'report-123',
        export_format: 'excel',
        template_config: {},
        export_options: {},
        status: 'processing',
        requested_by: 'user-123',
        started_at: '2024-01-10T10:10:00Z'
      }
    ]

    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        exportJobs={mockJobs}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    // Switch to queue tab
    const queueTab = screen.getByText('Export Queue')
    fireEvent.click(queueTab)

    expect(screen.getByText('PDF Document Export')).toBeInTheDocument()
    expect(screen.getByText('Excel Spreadsheet Export')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
  })

  it('handles download action', () => {
    const mockJobs: ExportJob[] = [
      {
        id: 'job-1',
        report_id: 'report-123',
        export_format: 'pdf',
        template_config: {},
        export_options: {},
        status: 'completed',
        file_url: '/downloads/job-1.pdf',
        file_size: 1024000,
        requested_by: 'user-123',
        started_at: '2024-01-10T10:00:00Z',
        completed_at: '2024-01-10T10:05:00Z'
      }
    ]

    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        exportJobs={mockJobs}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    // Switch to queue tab
    const queueTab = screen.getByText('Export Queue')
    fireEvent.click(queueTab)

    const downloadButton = screen.getByText('Download')
    fireEvent.click(downloadButton)

    expect(mockOnDownload).toHaveBeenCalledWith('job-1')
  })

  it('shows empty state when no export jobs', () => {
    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        exportJobs={[]}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    // Switch to queue tab
    const queueTab = screen.getByText('Export Queue')
    fireEvent.click(queueTab)

    expect(screen.getByText('No exports yet')).toBeInTheDocument()
    expect(
      screen.getByText('Configure and start an export to see it here')
    ).toBeInTheDocument()
  })

  it('switches to queue tab after export', async () => {
    mockOnExport.mockResolvedValue(undefined)

    render(
      <PMRExportManager
        reportId="report-123"
        report={mockReport}
        onExport={mockOnExport}
        onDownload={mockOnDownload}
      />
    )

    const exportButton = screen.getByText('Export as PDF Document')
    fireEvent.click(exportButton)

    await waitFor(() => {
      const queueTab = screen.getByText('Export Queue')
      expect(queueTab).toHaveClass('border-blue-500')
    })
  })
})
