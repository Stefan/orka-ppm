/**
 * PMR Export Manager Component
 * 
 * Provides export configuration and management interface for Enhanced PMR reports.
 * Features:
 * - Format selection (PDF, Excel, PowerPoint, Word)
 * - Template customization and branding options
 * - Export queue management with progress tracking
 * - Download interface with file management
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslations } from '../../lib/i18n/context'
import { ExportJob, PMRReport, PMRTemplate } from './types'

// Export format options
export type ExportFormat = 'pdf' | 'excel' | 'powerpoint' | 'word'

// Export configuration interface
export interface ExportConfig {
  format: ExportFormat
  templateId?: string
  options: {
    includeCharts: boolean
    includeRawData: boolean
    includeSections: string[]
    branding?: {
      logoUrl?: string
      colorScheme?: 'corporate_blue' | 'professional_gray' | 'modern_green'
      companyName?: string
    }
  }
}

// Export template interface
export interface ExportTemplate {
  id: string
  name: string
  description: string
  format: ExportFormat
  previewUrl?: string
  isDefault: boolean
}

// Component props
export interface PMRExportManagerProps {
  reportId: string
  report?: PMRReport
  availableFormats?: ExportFormat[]
  templates?: ExportTemplate[]
  exportJobs?: ExportJob[]
  onExport: (config: ExportConfig) => Promise<void>
  onDownload: (jobId: string) => void
  onCancelExport?: (jobId: string) => void
  onDeleteExport?: (jobId: string) => void
  className?: string
}

/**
 * PMRExportManager Component
 */
export const PMRExportManager: React.FC<PMRExportManagerProps> = ({
  reportId,
  report,
  availableFormats = ['pdf', 'excel', 'powerpoint', 'word'],
  templates = [],
  exportJobs = [],
  onExport,
  onDownload,
  onCancelExport,
  onDeleteExport,
  className = ''
}) => {
  const { t } = useTranslations()
  
  // State management
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [includeCharts, setIncludeCharts] = useState(true)
  const [includeRawData, setIncludeRawData] = useState(false)
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [brandingConfig, setBrandingConfig] = useState({
    logoUrl: '',
    colorScheme: 'corporate_blue' as const,
    companyName: ''
  })
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'configure' | 'queue'>('configure')

  // Initialize selected sections from report
  useEffect(() => {
    if (report?.sections && selectedSections.length === 0) {
      setSelectedSections(report.sections.map(s => s.section_id))
    }
  }, [report, selectedSections.length])

  // Filter templates by selected format
  const filteredTemplates = templates.filter(t => t.format === selectedFormat)

  // Get format icon
  const getFormatIcon = (format: ExportFormat): string => {
    const icons = {
      pdf: '📄',
      excel: '📊',
      powerpoint: '📽️',
      word: '📝'
    }
    return icons[format] || '📄'
  }

  // Get format label
  const getFormatLabel = (format: ExportFormat): string => {
    return t(`pmr.export.formats.${format}`)
  }

  // Get job status color
  const getStatusColor = (status: string): string => {
    const colors = {
      queued: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50',
      processing: 'text-blue-600 dark:text-blue-400 bg-blue-50',
      completed: 'text-green-600 dark:text-green-400 bg-green-50',
      failed: 'text-red-600 dark:text-red-400 bg-red-50'
    }
    return colors[status as keyof typeof colors] || 'text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50'
  }

  // Handle export
  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      const config: ExportConfig = {
        format: selectedFormat,
        templateId: selectedTemplate || undefined,
        options: {
          includeCharts,
          includeRawData,
          includeSections: selectedSections,
          branding: brandingConfig.logoUrl || brandingConfig.companyName
            ? brandingConfig
            : undefined
        }
      }
      await onExport(config)
      // Switch to queue tab after export
      setActiveTab('queue')
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [
    selectedFormat,
    selectedTemplate,
    includeCharts,
    includeRawData,
    selectedSections,
    brandingConfig,
    onExport
  ])

  // Toggle section selection
  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  // Select all sections
  const selectAllSections = () => {
    if (report?.sections) {
      setSelectedSections(report.sections.map(s => s.section_id))
    }
  }

  // Deselect all sections
  const deselectAllSections = () => {
    setSelectedSections([])
  }

  return (
    <div className={`pmr-export-manager bg-white dark:bg-slate-800 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('pmr.export.title')}</h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
          {t('pmr.export.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <div className="flex px-6">
          <button
            onClick={() => setActiveTab('configure')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'configure'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
            }`}
          >
            {t('pmr.export.tabs.configure')}
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'queue'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
            }`}
          >
            {t('pmr.export.tabs.queue')}
            {exportJobs.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full">
                {exportJobs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'configure' ? (
          <div className="space-y-6">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                {t('pmr.export.formats.label')}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {availableFormats.map(format => (
                  <button
                    key={format}
                    onClick={() => setSelectedFormat(format)}
                    className={`p-4 border-2 rounded-lg text-center transition-all ${
                      selectedFormat === format
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">{getFormatIcon(format)}</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {getFormatLabel(format)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Selection */}
            {filteredTemplates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                  {t('pmr.export.templates.label')}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedTemplate('')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedTemplate === ''
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-slate-100">{t('pmr.export.templates.default')}</div>
                    <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                      {t('pmr.export.templates.defaultDescription')}
                    </div>
                  </button>
                  {filteredTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        selectedTemplate === template.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-slate-100">{template.name}</div>
                      <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                        {template.description}
                      </div>
                      {template.isDefault && (
                        <span className="inline-block mt-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 rounded">
                          {t('pmr.export.templates.recommended')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Export Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                {t('pmr.export.options.label')}
              </label>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeCharts}
                    onChange={e => setIncludeCharts(e.target.checked)}
                    className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">
                    {t('pmr.export.options.includeCharts')}
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeRawData}
                    onChange={e => setIncludeRawData(e.target.checked)}
                    className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">
                    {t('pmr.export.options.includeRawData')}
                  </span>
                </label>
              </div>
            </div>

            {/* Section Selection */}
            {report?.sections && report.sections.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    {t('pmr.export.sections.label')}
                  </label>
                  <div className="space-x-2">
                    <button
                      onClick={selectAllSections}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                    >
                      {t('pmr.export.sections.selectAll')}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={deselectAllSections}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                    >
                      {t('pmr.export.sections.deselectAll')}
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg p-3">
                  {report.sections.map(section => (
                    <label key={section.section_id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedSections.includes(section.section_id)}
                        onChange={() => toggleSection(section.section_id)}
                        className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">
                        {section.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Branding Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                {t('pmr.export.branding.label')}
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                    {t('pmr.export.branding.companyName')}
                  </label>
                  <input
                    type="text"
                    value={brandingConfig.companyName}
                    onChange={e =>
                      setBrandingConfig(prev => ({
                        ...prev,
                        companyName: e.target.value
                      }))
                    }
                    placeholder={t('pmr.export.branding.companyNamePlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                    {t('pmr.export.branding.logoUrl')}
                  </label>
                  <input
                    type="text"
                    value={brandingConfig.logoUrl}
                    onChange={e =>
                      setBrandingConfig(prev => ({
                        ...prev,
                        logoUrl: e.target.value
                      }))
                    }
                    placeholder={t('pmr.export.branding.logoUrlPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                    {t('pmr.export.branding.colorScheme')}
                  </label>
                  <select
                    value={brandingConfig.colorScheme}
                    onChange={e =>
                      setBrandingConfig(prev => ({
                        ...prev,
                        colorScheme: e.target.value as any
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="corporate_blue">{t('pmr.export.branding.schemes.corporateBlue')}</option>
                    <option value="professional_gray">{t('pmr.export.branding.schemes.professionalGray')}</option>
                    <option value="modern_green">{t('pmr.export.branding.schemes.modernGreen')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Export Button */}
            <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={handleExport}
                disabled={isExporting || selectedSections.length === 0}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isExporting ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t('pmr.export.actions.exporting')}
                  </span>
                ) : (
                  t('pmr.export.actions.export', { format: getFormatLabel(selectedFormat) })
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Export Queue */
          <div className="space-y-4">
            {exportJobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📦</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
                  {t('pmr.export.queue.empty')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  {t('pmr.export.queue.emptyDescription')}
                </p>
              </div>
            ) : (
              exportJobs.map(job => (
                <div
                  key={job.id}
                  className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {getFormatIcon(job.export_format)}
                        </span>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-slate-100">
                            {getFormatLabel(job.export_format)} {t('pmr.export.title')}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-slate-400">
                            {t('pmr.export.queue.started', { date: new Date(job.started_at).toLocaleString() })}
                          </p>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="mt-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            job.status
                          )}`}
                        >
                          {t(`pmr.export.status.${job.status}`)}
                        </span>
                      </div>

                      {/* Progress bar for processing */}
                      {job.status === 'processing' && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full animate-pulse"
                              style={{ width: '60%' }}
                            />
                          </div>
                        </div>
                      )}

                      {/* File info for completed */}
                      {job.status === 'completed' && job.file_size && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                          {t('pmr.export.queue.fileSize', { size: (job.file_size / 1024).toFixed(2) })}
                        </p>
                      )}

                      {/* Error message */}
                      {job.status === 'failed' && job.error_message && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                          {t('pmr.export.queue.error', { message: job.error_message })}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col space-y-2 ml-4">
                      {job.status === 'completed' && (
                        <button
                          onClick={() => onDownload(job.id)}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          {t('pmr.export.actions.download')}
                        </button>
                      )}
                      {job.status === 'processing' && onCancelExport && (
                        <button
                          onClick={() => onCancelExport(job.id)}
                          className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-300 transition-colors"
                        >
                          {t('pmr.export.actions.cancel')}
                        </button>
                      )}
                      {(job.status === 'completed' || job.status === 'failed') &&
                        onDeleteExport && (
                          <button
                            onClick={() => onDeleteExport(job.id)}
                            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
                          >
                            {t('pmr.export.actions.delete')}
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default PMRExportManager
