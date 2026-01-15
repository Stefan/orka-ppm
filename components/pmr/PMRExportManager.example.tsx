/**
 * PMRExportManager Usage Example
 * 
 * This file demonstrates how to use the PMRExportManager component
 * in a real application context.
 */

'use client'

import React, { useState } from 'react'
import { PMRExportManager, ExportConfig } from './PMRExportManager'
import { PMRReport, ExportJob } from './types'

/**
 * Example: Basic Usage
 */
export function BasicExportExample() {
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([])

  // Mock report data
  const mockReport: PMRReport = {
    id: 'report-123',
    project_id: 'project-456',
    title: 'January 2024 Project Status Report',
    report_month: '2024-01',
    report_year: 2024,
    status: 'approved',
    sections: [
      {
        section_id: 'executive_summary',
        title: 'Executive Summary',
        content: 'Project is on track with 95% completion...',
        ai_generated: true,
        confidence_score: 0.92,
        last_modified: new Date().toISOString(),
        modified_by: 'user-123'
      },
      {
        section_id: 'budget_analysis',
        title: 'Budget Analysis',
        content: 'Current budget utilization is at 78%...',
        ai_generated: false,
        last_modified: new Date().toISOString(),
        modified_by: 'user-123'
      },
      {
        section_id: 'schedule_performance',
        title: 'Schedule Performance',
        content: 'Schedule performance index is 1.12...',
        ai_generated: true,
        confidence_score: 0.88,
        last_modified: new Date().toISOString(),
        modified_by: 'user-123'
      }
    ],
    ai_insights: [],
    real_time_metrics: {},
    confidence_scores: {},
    template_customizations: {},
    generated_by: 'user-123',
    generated_at: new Date().toISOString(),
    last_modified: new Date().toISOString(),
    version: 1
  }

  const handleExport = async (config: ExportConfig) => {
    console.log('Exporting with config:', config)

    // Create a new export job
    const newJob: ExportJob = {
      id: `job-${Date.now()}`,
      report_id: mockReport.id,
      export_format: config.format,
      template_config: config.templateId ? { templateId: config.templateId } : {},
      export_options: config.options,
      status: 'processing',
      requested_by: 'user-123',
      started_at: new Date().toISOString()
    }

    setExportJobs(prev => [newJob, ...prev])

    // Simulate export processing
    setTimeout(() => {
      setExportJobs(prev =>
        prev.map(job =>
          job.id === newJob.id
            ? {
                ...job,
                status: 'completed',
                file_url: `/downloads/${job.id}.${config.format}`,
                file_size: Math.floor(Math.random() * 1000000) + 100000,
                completed_at: new Date().toISOString()
              }
            : job
        )
      )
    }, 3000)
  }

  const handleDownload = (jobId: string) => {
    const job = exportJobs.find(j => j.id === jobId)
    if (job?.file_url) {
      console.log('Downloading:', job.file_url)
      // In a real app, trigger file download
      window.open(job.file_url, '_blank')
    }
  }

  const handleDeleteExport = (jobId: string) => {
    setExportJobs(prev => prev.filter(job => job.id !== jobId))
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">PMR Export Manager - Basic Example</h1>
      <PMRExportManager
        reportId={mockReport.id}
        report={mockReport}
        exportJobs={exportJobs}
        onExport={handleExport}
        onDownload={handleDownload}
        onDeleteExport={handleDeleteExport}
      />
    </div>
  )
}

/**
 * Example: With Templates
 */
export function ExportWithTemplatesExample() {
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([])

  const mockReport: PMRReport = {
    id: 'report-789',
    project_id: 'project-101',
    title: 'Q1 2024 Executive Report',
    report_month: '2024-03',
    report_year: 2024,
    status: 'approved',
    sections: [
      {
        section_id: 'executive_summary',
        title: 'Executive Summary',
        content: 'Quarterly performance exceeded expectations...',
        ai_generated: true,
        confidence_score: 0.95,
        last_modified: new Date().toISOString(),
        modified_by: 'user-456'
      }
    ],
    ai_insights: [],
    real_time_metrics: {},
    confidence_scores: {},
    template_customizations: {},
    generated_by: 'user-456',
    generated_at: new Date().toISOString(),
    last_modified: new Date().toISOString(),
    version: 1
  }

  // Mock templates
  const templates = [
    {
      id: 'template-executive',
      name: 'Executive Dashboard',
      description: 'High-level overview for executives with key metrics and insights',
      format: 'pdf' as const,
      isDefault: true
    },
    {
      id: 'template-detailed',
      name: 'Detailed Analysis',
      description: 'Comprehensive report with all sections and data tables',
      format: 'pdf' as const,
      isDefault: false
    },
    {
      id: 'template-excel-data',
      name: 'Data Export',
      description: 'Excel workbook with raw data and charts',
      format: 'excel' as const,
      isDefault: true
    },
    {
      id: 'template-presentation',
      name: 'Executive Presentation',
      description: 'PowerPoint slides for stakeholder meetings',
      format: 'powerpoint' as const,
      isDefault: true
    }
  ]

  const handleExport = async (config: ExportConfig) => {
    const newJob: ExportJob = {
      id: `job-${Date.now()}`,
      report_id: mockReport.id,
      export_format: config.format,
      template_config: config.templateId ? { templateId: config.templateId } : {},
      export_options: config.options,
      status: 'queued',
      requested_by: 'user-456',
      started_at: new Date().toISOString()
    }

    setExportJobs(prev => [newJob, ...prev])

    // Simulate queue processing
    setTimeout(() => {
      setExportJobs(prev =>
        prev.map(job =>
          job.id === newJob.id ? { ...job, status: 'processing' } : job
        )
      )
    }, 1000)

    setTimeout(() => {
      setExportJobs(prev =>
        prev.map(job =>
          job.id === newJob.id
            ? {
                ...job,
                status: 'completed',
                file_url: `/downloads/${job.id}.${config.format}`,
                file_size: Math.floor(Math.random() * 2000000) + 500000,
                completed_at: new Date().toISOString()
              }
            : job
        )
      )
    }, 5000)
  }

  const handleDownload = (jobId: string) => {
    const job = exportJobs.find(j => j.id === jobId)
    if (job?.file_url) {
      alert(`Downloading: ${job.file_url}`)
    }
  }

  const handleCancelExport = (jobId: string) => {
    setExportJobs(prev =>
      prev.map(job =>
        job.id === jobId
          ? { ...job, status: 'failed', error_message: 'Cancelled by user' }
          : job
      )
    )
  }

  const handleDeleteExport = (jobId: string) => {
    setExportJobs(prev => prev.filter(job => job.id !== jobId))
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        PMR Export Manager - With Templates
      </h1>
      <PMRExportManager
        reportId={mockReport.id}
        report={mockReport}
        templates={templates}
        exportJobs={exportJobs}
        onExport={handleExport}
        onDownload={handleDownload}
        onCancelExport={handleCancelExport}
        onDeleteExport={handleDeleteExport}
      />
    </div>
  )
}

/**
 * Example: Integration with API
 */
export function ExportWithAPIExample() {
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const mockReport: PMRReport = {
    id: 'report-api-123',
    project_id: 'project-api-456',
    title: 'API Integration Example Report',
    report_month: '2024-01',
    report_year: 2024,
    status: 'approved',
    sections: [
      {
        section_id: 'section-1',
        title: 'Section 1',
        content: 'Content...',
        ai_generated: false,
        last_modified: new Date().toISOString(),
        modified_by: 'user-789'
      }
    ],
    ai_insights: [],
    real_time_metrics: {},
    confidence_scores: {},
    template_customizations: {},
    generated_by: 'user-789',
    generated_at: new Date().toISOString(),
    last_modified: new Date().toISOString(),
    version: 1
  }

  const handleExport = async (config: ExportConfig) => {
    setIsLoading(true)
    try {
      // In a real app, call the API
      const response = await fetch(`/api/reports/pmr/${mockReport.id}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format: config.format,
          template_id: config.templateId,
          options: config.options
        })
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const data = await response.json()

      // Add the new job to the list
      const newJob: ExportJob = {
        id: data.export_job_id,
        report_id: mockReport.id,
        export_format: config.format,
        template_config: {},
        export_options: config.options,
        status: data.status,
        requested_by: 'current-user',
        started_at: new Date().toISOString()
      }

      setExportJobs(prev => [newJob, ...prev])

      // Poll for job status
      pollJobStatus(newJob.id)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/reports/pmr/export/${jobId}/status`)
        const data = await response.json()

        setExportJobs(prev =>
          prev.map(job =>
            job.id === jobId
              ? {
                  ...job,
                  status: data.status,
                  file_url: data.download_url,
                  file_size: data.file_size,
                  completed_at: data.completed_at,
                  error_message: data.error_message
                }
              : job
          )
        )

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval)
        }
      } catch (error) {
        console.error('Failed to poll job status:', error)
        clearInterval(interval)
      }
    }, 2000)
  }

  const handleDownload = async (jobId: string) => {
    const job = exportJobs.find(j => j.id === jobId)
    if (job?.file_url) {
      // Trigger download
      const link = document.createElement('a')
      link.href = job.file_url
      link.download = `report-${job.report_id}.${job.export_format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleDeleteExport = async (jobId: string) => {
    try {
      await fetch(`/api/reports/pmr/export/${jobId}`, {
        method: 'DELETE'
      })
      setExportJobs(prev => prev.filter(job => job.id !== jobId))
    } catch (error) {
      console.error('Failed to delete export:', error)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        PMR Export Manager - API Integration
      </h1>
      {isLoading && (
        <div className="mb-4 p-4 bg-blue-50 text-blue-700 rounded-lg">
          Initiating export...
        </div>
      )}
      <PMRExportManager
        reportId={mockReport.id}
        report={mockReport}
        exportJobs={exportJobs}
        onExport={handleExport}
        onDownload={handleDownload}
        onDeleteExport={handleDeleteExport}
      />
    </div>
  )
}

export default BasicExportExample
