'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  Receipt,
  Loader2,
  AlertTriangle,
  Info
} from 'lucide-react'
import { 
  validateCSVFormat, 
  parseCSVToCommitments, 
  parseCSVToActuals,
  downloadCSVTemplate,
  COMMITMENT_COLUMNS,
  ACTUAL_COLUMNS
} from '@/lib/costbook/csv-import'
import { Commitment, Actual, CSVImportResult, CSVImportError } from '@/types/costbook'

export type ImportType = 'commitment' | 'actual'

export interface CSVImportDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Handler to close the dialog */
  onClose: () => void
  /** Handler called when import is complete */
  onImport: (result: CSVImportResult, data: Partial<Commitment>[] | Partial<Actual>[]) => void
  /** Default import type */
  defaultType?: ImportType
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

type ImportStep = 'select' | 'preview' | 'importing' | 'result'

/**
 * CSVImportDialog component for importing commitments and actuals from CSV
 * Supports drag-and-drop file upload with validation and preview
 */
export function CSVImportDialog({
  isOpen,
  onClose,
  onImport,
  defaultType = 'commitment',
  className = '',
  'data-testid': testId = 'csv-import-dialog'
}: CSVImportDialogProps) {
  // State
  const [importType, setImportType] = useState<ImportType>(defaultType)
  const [step, setStep] = useState<ImportStep>('select')
  const [file, setFile] = useState<File | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [parseErrors, setParseErrors] = useState<CSVImportError[]>([])
  const [parsedData, setParsedData] = useState<Partial<Commitment>[] | Partial<Actual>[]>([])
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state
  const resetState = useCallback(() => {
    setStep('select')
    setFile(null)
    setValidationErrors([])
    setParseErrors([])
    setParsedData([])
    setImportResult(null)
    setIsProcessing(false)
  }, [])

  // Handle close
  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setIsProcessing(true)
    setValidationErrors([])
    setParseErrors([])

    try {
      // Validate format
      const expectedColumns = importType === 'commitment' ? COMMITMENT_COLUMNS : ACTUAL_COLUMNS
      const validation = await validateCSVFormat(selectedFile, expectedColumns)

      if (!validation.valid) {
        setValidationErrors(validation.errors)
        setIsProcessing(false)
        return
      }

      // Parse file
      if (importType === 'commitment') {
        const { commitments, errors } = await parseCSVToCommitments(selectedFile)
        setParsedData(commitments)
        setParseErrors(errors)
      } else {
        const { actuals, errors } = await parseCSVToActuals(selectedFile)
        setParsedData(actuals)
        setParseErrors(errors)
      }

      setStep('preview')
    } catch (error) {
      setValidationErrors([`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`])
    } finally {
      setIsProcessing(false)
    }
  }, [importType])

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        handleFileSelect(acceptedFiles[0])
      }
    },
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
    disabled: isProcessing
  })

  // Handle import
  const handleImport = useCallback(async () => {
    setStep('importing')
    setIsProcessing(true)

    try {
      // Simulate import delay (in real app, this would be an API call)
      await new Promise(resolve => setTimeout(resolve, 1000))

      const result: CSVImportResult = {
        success: parseErrors.length === 0,
        records_processed: parsedData.length + parseErrors.length,
        records_imported: parsedData.length,
        errors: parseErrors
      }

      setImportResult(result)
      setStep('result')

      // Notify parent
      onImport(result, parsedData)
    } catch (error) {
      setImportResult({
        success: false,
        records_processed: 0,
        records_imported: 0,
        errors: [{ row: 0, column: '', value: '', error: 'Import failed' }]
      })
      setStep('result')
    } finally {
      setIsProcessing(false)
    }
  }, [parsedData, parseErrors, onImport])

  // Download template
  const handleDownloadTemplate = useCallback(() => {
    downloadCSVTemplate(importType)
  }, [importType])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid={testId}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className={`relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Import CSV
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step: Select */}
          {step === 'select' && (
            <div className="space-y-6">
              {/* Import type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Import Type
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setImportType('commitment')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      importType === 'commitment'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    <span className="font-medium">Commitments</span>
                  </button>
                  <button
                    onClick={() => setImportType('actual')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      importType === 'actual'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Receipt className="w-5 h-5" />
                    <span className="font-medium">Actuals</span>
                  </button>
                </div>
              </div>

              {/* File dropzone */}
              <div
                {...getRootProps()}
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                  ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input {...getInputProps()} ref={fileInputRef} />
                
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-blue-500 dark:text-blue-400 animate-spin" />
                    <p className="text-gray-600 dark:text-gray-400">Processing file...</p>
                  </div>
                ) : (
                  <>
                    <Upload className={`w-10 h-10 mx-auto mb-4 ${
                      isDragActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'
                    }`} />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      {isDragActive 
                        ? 'Drop the file here...' 
                        : 'Drag and drop a CSV file here, or click to select'
                      }
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Supports .csv files
                    </p>
                  </>
                )}
              </div>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-300">
                        Validation Errors
                      </h4>
                      <ul className="mt-2 text-sm text-red-700 dark:text-red-400 list-disc list-inside">
                        {validationErrors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Template download */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Info className="w-4 h-4" />
                  <span>Need a template?</span>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* File info */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <FileSpreadsheet className="w-8 h-8 text-green-500 dark:text-green-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{file?.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {parsedData.length} records ready to import
                    {parseErrors.length > 0 && ` • ${parseErrors.length} errors`}
                  </p>
                </div>
              </div>

              {/* Parse errors */}
              {parseErrors.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                        {parseErrors.length} rows have errors and will be skipped
                      </h4>
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-yellow-700 dark:text-yellow-400">
                              <th className="pr-4">Row</th>
                              <th className="pr-4">Column</th>
                              <th>Error</th>
                            </tr>
                          </thead>
                          <tbody className="text-yellow-600 dark:text-yellow-400">
                            {parseErrors.slice(0, 10).map((error, i) => (
                              <tr key={i}>
                                <td className="pr-4">{error.row}</td>
                                <td className="pr-4">{error.column || '-'}</td>
                                <td>{error.error}</td>
                              </tr>
                            ))}
                            {parseErrors.length > 10 && (
                              <tr>
                                <td colSpan={3} className="pt-2">
                                  ...and {parseErrors.length - 10} more errors
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preview (first 5 rows)
                </h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        {importType === 'commitment' ? (
                          <>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">PO #</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Vendor</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Description</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
                          </>
                        ) : (
                          <>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">PO #</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Vendor</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Description</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {parsedData.slice(0, 5).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-gray-800/50">
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.po_number || '-'}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.vendor_name}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{row.description}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-gray-100">
                            ${row.amount?.toLocaleString() || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-500 dark:text-blue-400 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Importing {parsedData.length} records...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Please wait, this may take a moment
              </p>
            </div>
          )}

          {/* Step: Result */}
          {step === 'result' && importResult && (
            <div className="space-y-6">
              {/* Success/Error banner */}
              <div className={`p-6 rounded-lg ${
                importResult.success
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                <div className="flex items-center gap-4">
                  {importResult.success ? (
                    <CheckCircle className="w-12 h-12 text-green-500 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400" />
                  )}
                  <div>
                    <h3 className={`text-lg font-semibold ${
                      importResult.success
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}>
                      {importResult.success ? 'Import Successful' : 'Import Completed with Errors'}
                    </h3>
                    <p className={`text-sm mt-1 ${
                      importResult.success
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}>
                      {importResult.records_imported} of {importResult.records_processed} records imported
                    </p>
                  </div>
                </div>
              </div>

              {/* Error list */}
              {importResult.errors.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Errors ({importResult.errors.length})
                  </h4>
                  <div className="max-h-48 overflow-y-auto">
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {importResult.errors.map((error, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-gray-400 dark:text-slate-500">Row {error.row}:</span>
                          <span>{error.error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {step === 'select' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={resetState}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={parsedData.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Import {parsedData.length} Records
              </button>
            </>
          )}

          {step === 'result' && (
            <>
              <button
                onClick={resetState}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Import Another
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CSVImportDialog
