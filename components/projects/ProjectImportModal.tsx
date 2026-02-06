'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Copy, Check, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { cn } from '@/lib/design-system'

interface ImportError {
  index: number
  field: string
  value: any
  error: string
}

interface ImportResult {
  success: boolean
  count: number
  errors: ImportError[]
  message: string
}

type ImportMethod = 'json' | 'csv'

interface ProjectImportModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId?: string
}

/**
 * Modal component for importing projects via JSON or CSV
 * Supports JSON textarea input and CSV drag-and-drop upload
 * 
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */
export default function ProjectImportModal({ 
  isOpen, 
  onClose,
  portfolioId = ''
}: ProjectImportModalProps) {
  const [method, setMethod] = useState<ImportMethod>('json')
  const [jsonInput, setJsonInput] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [copied, setCopied] = useState(false)

  // Handle CSV file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setCsvFile(acceptedFiles[0])
      setResult(null) // Clear previous results
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  })

  // Handle JSON import
  const handleJsonImport = async () => {
    setLoading(true)
    setResult(null)

    try {
      // Validate JSON format before sending
      let parsedJson
      try {
        parsedJson = JSON.parse(jsonInput)
        if (!Array.isArray(parsedJson)) {
          setResult({
            success: false,
            count: 0,
            errors: [{
              index: 0,
              field: 'root',
              value: typeof parsedJson,
              error: 'Input must be a JSON array of projects'
            }],
            message: 'Invalid JSON format: expected an array'
          })
          return
        }
      } catch (parseError) {
        setResult({
          success: false,
          count: 0,
          errors: [{
            index: 0,
            field: 'json',
            value: jsonInput.substring(0, 50) + '...',
            error: 'Invalid JSON syntax'
          }],
          message: 'Failed to parse JSON input'
        })
        return
      }

      const response = await fetch('/api/projects/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedJson),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        count: 0,
        errors: [{
          index: 0,
          field: 'network',
          value: null,
          error: 'Network error occurred while importing'
        }],
        message: 'Failed to connect to the server'
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle CSV import
  const handleCsvImport = async () => {
    if (!csvFile) return

    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', csvFile)

      const response = await fetch(`/api/projects/import/csv?portfolio_id=${portfolioId}`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        count: 0,
        errors: [{
          index: 0,
          field: 'network',
          value: null,
          error: 'Network error occurred while importing'
        }],
        message: 'Failed to connect to the server'
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle import based on selected method
  const handleImport = () => {
    if (method === 'json') {
      handleJsonImport()
    } else {
      handleCsvImport()
    }
  }

  // Copy errors to clipboard
  const handleCopyErrors = async () => {
    if (!result?.errors.length) return

    const errorText = result.errors
      .map(err => `Record ${err.index + 1}: ${err.field} - ${err.error} (value: ${JSON.stringify(err.value)})`)
      .join('\n')

    try {
      await navigator.clipboard.writeText(errorText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy errors:', error)
    }
  }

  // Reset state when closing
  const handleClose = () => {
    setJsonInput('')
    setCsvFile(null)
    setResult(null)
    setLoading(false)
    setCopied(false)
    onClose()
  }

  // Check if import button should be disabled
  const isImportDisabled = loading || 
    (method === 'json' && !jsonInput.trim()) || 
    (method === 'csv' && !csvFile)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Projects"
      size="lg"
    >
      <div className="space-y-6 pt-4">
        {/* Method Selection Tabs - Req 6.2 */}
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={() => {
              setMethod('json')
              setResult(null)
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              method === 'json'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
            )}
          >
            <FileText className="w-4 h-4" />
            JSON Input
          </button>
          <button
            onClick={() => {
              setMethod('csv')
              setResult(null)
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              method === 'csv'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
            )}
          >
            <Upload className="w-4 h-4" />
            CSV Upload
          </button>
        </div>

        {/* JSON Input - Req 6.3 */}
        {method === 'json' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Paste JSON Array
            </label>
            <textarea
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value)
                setResult(null)
              }}
              placeholder={`[
  {
    "name": "Project Alpha",
    "budget": 150000,
    "status": "planning",
    "start_date": "2024-01-15",
    "end_date": "2024-12-31",
    "description": "Strategic initiative"
  }
]`}
              rows={10}
              className="font-mono text-sm w-full px-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 resize-vertical"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Required fields: name, budget, status. Optional: start_date, end_date, description
            </p>
          </div>
        )}

        {/* CSV Upload - Req 6.4 */}
        {method === 'csv' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Upload CSV File
            </label>
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-300 dark:border-slate-600 hover:border-gray-400',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input {...getInputProps()} disabled={loading} />
              <Upload className={cn(
                'w-10 h-10 mx-auto mb-3',
                isDragActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'
              )} />
              {csvFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{csvFile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {(csvFile.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCsvFile(null)
                      setResult(null)
                    }}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-700"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    {isDragActive
                      ? 'Drop the CSV file here...'
                      : 'Drag & drop a CSV file here, or click to select'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Only .csv files are accepted
                  </p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Required columns: name, budget, status. Optional: start_date, end_date, description
            </p>
          </div>
        )}

        {/* Loading State - Req 6.5 */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin mr-2" />
            <span className="text-sm text-gray-600 dark:text-slate-400">Processing import...</span>
          </div>
        )}

        {/* Success Message - Req 6.6 */}
        {result?.success && (
          <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <AlertDescription>
              <span className="font-medium">Import successful!</span>
              <br />
              {result.count} project{result.count !== 1 ? 's' : ''} imported successfully.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Messages - Req 6.7, 6.8 */}
        {result && !result.success && result.errors.length > 0 && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <AlertDescription>
                <span className="font-medium">Import failed</span>
                <br />
                {result.message}
              </AlertDescription>
            </Alert>

            {/* Error Details */}
            <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
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
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Record</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Field</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {result.errors.map((error, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                        <td className="px-4 py-2 text-gray-900 dark:text-slate-100 font-medium">
                          #{error.index + 1}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-slate-400">
                          {error.field}
                          {error.value !== null && error.value !== undefined && (
                            <span className="block text-xs text-gray-400 dark:text-slate-500 truncate max-w-[150px]">
                              Value: {JSON.stringify(error.value)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-red-600 dark:text-red-400">
                          {error.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            {result?.success ? 'Close' : 'Cancel'}
          </Button>
          {!result?.success && (
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={isImportDisabled}
              loading={loading}
            >
              Import Projects
            </Button>
          )}
        </ModalFooter>
      </div>
    </Modal>
  )
}
