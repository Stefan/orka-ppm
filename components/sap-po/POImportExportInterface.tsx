'use client'

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { 
  Upload, 
  Download, 
  FileText, 
  FileSpreadsheet,
  Check, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Loader2,
  Copy,
  Settings,
  Filter
} from 'lucide-react'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { cn } from '@/lib/design-system'
import { getApiUrl } from '@/lib/api'

/**
 * Import Error Interface
 */
interface ImportError {
  row_number: number
  field: string
  value: any
  error: string
  conflict_type?: string
}

/**
 * Import Result Interface
 */
interface ImportResult {
  success: boolean
  batch_id?: string
  total_records: number
  processed_records: number
  successful_records: number
  failed_records: number
  conflicts: ImportError[]
  errors: ImportError[]
  warnings: ImportError[]
  processing_time_ms: number
  message: string
}

/**
 * Export Configuration Interface
 */
interface ExportConfig {
  format: 'csv' | 'excel' | 'json'
  includeHierarchy: boolean
  includeFinancials: boolean
  includeCustomFields: boolean
  filterByStatus?: string[]
  filterByCategory?: string[]
}

/**
 * Component Props
 */
export interface POImportExportInterfaceProps {
  projectId: string
  onImportComplete?: (result: ImportResult) => void
  onExportComplete?: (success: boolean) => void
  className?: string
}

/**
 * POImportExportInterface Component
 * 
 * File upload interface with progress tracking and error display for SAP PO imports.
 * Export configuration interface with format and filter selection.
 * 
 * Requirements: 1.5, 9.6
 */
export const POImportExportInterface: React.FC<POImportExportInterfaceProps> = ({
  projectId,
  onImportComplete,
  onExportComplete,
  className = ''
}) => {
  const [mode, setMode] = useState<'import' | 'export'>('import')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  
  // Export configuration
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'excel',
    includeHierarchy: true,
    includeFinancials: true,
    includeCustomFields: false,
    filterByStatus: [],
    filterByCategory: []
  })

  // Handle file drop for import
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setImportFile(acceptedFiles[0])
      setResult(null)
      setProgress(0)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  })

  // Handle import
  const handleImport = async () => {
    if (!importFile) return

    setLoading(true)
    setResult(null)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('project_id', projectId)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      const response = await fetch(getApiUrl(`/api/v1/projects/${projectId}/po-breakdowns/import`), {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const data = await response.json()
      setResult(data)
      onImportComplete?.(data)
    } catch (error) {
      setResult({
        success: false,
        total_records: 0,
        processed_records: 0,
        successful_records: 0,
        failed_records: 0,
        conflicts: [],
        errors: [{
          row_number: 0,
          field: 'network',
          value: null,
          error: 'Network error occurred while importing'
        }],
        warnings: [],
        processing_time_ms: 0,
        message: 'Failed to connect to the server'
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle export
  const handleExport = async () => {
    setLoading(true)

    try {
      const queryParams = new URLSearchParams({
        format: exportConfig.format,
        include_hierarchy: exportConfig.includeHierarchy.toString(),
        include_financials: exportConfig.includeFinancials.toString(),
        include_custom_fields: exportConfig.includeCustomFields.toString(),
      })

      if (exportConfig.filterByStatus && exportConfig.filterByStatus.length > 0) {
        queryParams.append('filter_status', exportConfig.filterByStatus.join(','))
      }

      if (exportConfig.filterByCategory && exportConfig.filterByCategory.length > 0) {
        queryParams.append('filter_category', exportConfig.filterByCategory.join(','))
      }

      const response = await fetch(
        getApiUrl(`/api/v1/projects/${projectId}/po-breakdowns/export?${queryParams}`),
        { method: 'GET' }
      )

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `po-breakdown-${projectId}.${exportConfig.format === 'excel' ? 'xlsx' : exportConfig.format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      onExportComplete?.(true)
    } catch (error) {
      console.error('Export error:', error)
      onExportComplete?.(false)
    } finally {
      setLoading(false)
    }
  }

  // Copy errors to clipboard
  const handleCopyErrors = async () => {
    if (!result?.errors.length) return

    const errorText = result.errors
      .map(err => `Row ${err.row_number}: ${err.field} - ${err.error} (value: ${JSON.stringify(err.value)})`)
      .join('\n')

    try {
      await navigator.clipboard.writeText(errorText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy errors:', error)
    }
  }

  // Reset state
  const handleReset = () => {
    setImportFile(null)
    setResult(null)
    setProgress(0)
    setLoading(false)
    setCopied(false)
  }

  return (
    <div className={cn('bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700', className)}>
      {/* Mode Selection Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => {
            setMode('import')
            handleReset()
          }}
          className={cn(
            'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors',
            mode === 'import'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
          )}
        >
          <Upload className="w-4 h-4" />
          Import SAP Data
        </button>
        <button
          onClick={() => {
            setMode('export')
            handleReset()
          }}
          className={cn(
            'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors',
            mode === 'export'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
          )}
        >
          <Download className="w-4 h-4" />
          Export Data
        </button>
      </div>

      <div className="p-6">
        {/* Import Mode */}
        {mode === 'import' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Import PO Breakdown Data</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Upload CSV or Excel files containing SAP PO breakdown data. The system will validate and process the data automatically.
              </p>
            </div>

            {/* File Upload Area - Req 1.5 */}
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
                isDragActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 bg-gray-50 dark:bg-slate-800/50',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input {...getInputProps()} disabled={loading} />
              <div className="flex flex-col items-center">
                {importFile ? (
                  <>
                    {importFile.name.endsWith('.csv') ? (
                      <FileText className="w-16 h-16 text-blue-500 dark:text-blue-400 mb-4" />
                    ) : (
                      <FileSpreadsheet className="w-16 h-16 text-green-500 dark:text-green-400 mb-4" />
                    )}
                    <p className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-1">{importFile.name}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                      {(importFile.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setImportFile(null)
                        setResult(null)
                      }}
                      className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 font-medium"
                    >
                      Remove file
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className={cn(
                      'w-16 h-16 mb-4',
                      isDragActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'
                    )} />
                    <p className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-1">
                      {isDragActive
                        ? 'Drop the file here...'
                        : 'Drag & drop a file here'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                      or click to select a file
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      Supported formats: CSV, XLS, XLSX
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Progress Bar - Req 1.5 */}
            {loading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Processing import...</span>
                  <span className="text-gray-900 dark:text-slate-100 font-medium">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success Message */}
            {result?.success && (
              <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <AlertDescription>
                  <span className="font-medium">Import successful!</span>
                  <br />
                  {result.successful_records} of {result.total_records} records imported successfully.
                  {result.processing_time_ms && (
                    <span className="text-xs block mt-1">
                      Processing time: {(result.processing_time_ms / 1000).toFixed(2)}s
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Error Display - Req 1.5 */}
            {result && !result.success && result.errors.length > 0 && (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <AlertDescription>
                    <span className="font-medium">Import failed</span>
                    <br />
                    {result.message}
                    <br />
                    <span className="text-sm">
                      {result.failed_records} of {result.total_records} records failed
                    </span>
                  </AlertDescription>
                </Alert>

                {/* Error Details Table */}
                <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                    <span className="text-sm font-medium text-red-800 dark:text-red-300">
                      {result.errors.length} error{result.errors.length !== 1 ? 's' : ''} found
                    </span>
                    <button
                      onClick={handleCopyErrors}
                      className="flex items-center gap-1 text-xs text-red-700 hover:text-red-800 dark:hover:text-red-300 dark:text-red-300 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy errors
                        </>
                      )}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-slate-800/50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Row</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Field</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Error</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {result.errors.map((error, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                            <td className="px-4 py-2 text-gray-900 dark:text-slate-100 font-medium">
                              #{error.row_number}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-slate-400 font-mono text-xs">
                              {error.field}
                            </td>
                            <td className="px-4 py-2 text-red-600 dark:text-red-400">
                              {error.error}
                            </td>
                            <td className="px-4 py-2 text-gray-500 dark:text-slate-400 text-xs truncate max-w-[150px]">
                              {JSON.stringify(error.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings */}
            {result && result.warnings && result.warnings.length > 0 && (
              <Alert variant="default" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <AlertDescription>
                  <span className="font-medium">{result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}</span>
                  <ul className="mt-2 space-y-1 text-sm">
                    {result.warnings.slice(0, 3).map((warning, idx) => (
                      <li key={idx}>Row {warning.row_number}: {warning.error}</li>
                    ))}
                    {result.warnings.length > 3 && (
                      <li className="text-xs">...and {result.warnings.length - 3} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
              {result && (
                <Button
                  variant="secondary"
                  onClick={handleReset}
                >
                  Import Another File
                </Button>
              )}
              {!result && (
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={!importFile || loading}
                  loading={loading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Start Import
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Export Mode - Req 9.6 */}
        {mode === 'export' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Export PO Breakdown Data</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Configure export settings and download your PO breakdown data in your preferred format.
              </p>
            </div>

            {/* Export Format Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Export Format
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['csv', 'excel', 'json'] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setExportConfig(prev => ({ ...prev, format }))}
                    className={cn(
                      'flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-colors',
                      exportConfig.format === format
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 text-gray-600 dark:text-slate-400'
                    )}
                  >
                    {format === 'csv' && <FileText className="w-8 h-8 mb-2" />}
                    {format === 'excel' && <FileSpreadsheet className="w-8 h-8 mb-2" />}
                    {format === 'json' && <FileText className="w-8 h-8 mb-2" />}
                    <span className="text-sm font-medium uppercase">{format}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Export Options */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Include in Export
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeHierarchy}
                    onChange={(e) => setExportConfig(prev => ({ ...prev, includeHierarchy: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">Hierarchy relationships</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeFinancials}
                    onChange={(e) => setExportConfig(prev => ({ ...prev, includeFinancials: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">Financial data and variances</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeCustomFields}
                    onChange={(e) => setExportConfig(prev => ({ ...prev, includeCustomFields: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">Custom fields and metadata</span>
                </label>
              </div>
            </div>

            {/* Filter Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Filters (Optional)
                </label>
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Filter className="w-3 h-3" />
                  {showConfig ? 'Hide' : 'Show'} Filters
                </button>
              </div>
              
              {showConfig && (
                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Filter by Status
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['on-track', 'at-risk', 'critical'].map((status) => (
                        <label key={status} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={exportConfig.filterByStatus?.includes(status)}
                            onChange={(e) => {
                              setExportConfig(prev => ({
                                ...prev,
                                filterByStatus: e.target.checked
                                  ? [...(prev.filterByStatus || []), status]
                                  : (prev.filterByStatus || []).filter(s => s !== status)
                              }))
                            }}
                            className="w-3 h-3 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 rounded"
                          />
                          <span className="text-xs text-gray-700 dark:text-slate-300 capitalize">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
              <Button
                variant="primary"
                onClick={handleExport}
                disabled={loading}
                loading={loading}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default POImportExportInterface
