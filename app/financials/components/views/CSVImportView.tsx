'use client'

import React, { useState, useEffect } from 'react'
import { Upload, Download, CheckCircle, XCircle, Clock, RefreshCw, FileText, History } from 'lucide-react'
import { CSVImportHistory, CSVUploadResult } from '../../types'
import { getApiUrl } from '../../../../lib/api'
import { logger } from '@/lib/monitoring/logger'
import { useTranslations } from '@/lib/i18n/context'

interface CSVImportViewProps {
  accessToken: string | undefined
}

export default function CSVImportView({ accessToken }: CSVImportViewProps) {
  const t = useTranslations('dataImport')
  const [csvImportHistory, setCsvImportHistory] = useState<CSVImportHistory[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadResult, setUploadResult] = useState<CSVUploadResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    const timeoutId = setTimeout(() => fetchCSVImportHistory(), 100)
    return () => clearTimeout(timeoutId)
  }, [accessToken])

  const fetchCSVImportHistory = async () => {
    if (!accessToken) return
    
    try {
      const response = await fetch(getApiUrl('/csv-import/history'), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCsvImportHistory(data.imports || [])
      }
    } catch (error) {
      logger.error('Failed to fetch CSV import history', { error }, 'CSVImportView')
    }
  }

  const handleFileUpload = async (file: File, importType: 'commitments' | 'actuals') => {
    if (!accessToken) return
    
    setUploadingFile(true)
    setUploadResult(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      // Create abort controller for timeout (5 minutes for large imports)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minutes
      
      const response = await fetch(getApiUrl(`/csv-import/upload?import_type=${importType}`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const result = await response.json()
        setUploadResult(result)
        fetchCSVImportHistory() // Refresh history
      } else {
        const error = await response.json()
        const errorMessage = typeof error.detail === 'string' 
          ? error.detail 
          : Array.isArray(error.detail)
            ? error.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ')
            : 'Upload failed'
        
        setUploadResult({
          success: false,
          records_processed: 0,
          records_imported: 0,
          errors: [{ row: 0, field: 'file', message: errorMessage }],
          warnings: [],
          import_id: ''
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.name === 'AbortError' 
          ? 'Import timeout - Die Datei ist zu groß oder der Server antwortet nicht. Bitte versuchen Sie es mit einer kleineren Datei.'
          : error.message
        : 'Upload failed'
      
      setUploadResult({
        success: false,
        records_processed: 0,
        records_imported: 0,
        errors: [{ row: 0, field: 'file', message: errorMessage }],
        warnings: [],
        import_id: ''
      })
    } finally {
      setUploadingFile(false)
    }
  }

  const downloadTemplate = async (importType: 'commitments' | 'actuals') => {
    if (!accessToken) return
    
    try {
      const response = await fetch(getApiUrl(`/csv-import/template/${importType}`), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${importType}_template.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      logger.error('Failed to download template', { error }, 'CSVImportView')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent, importType: 'commitments' | 'actuals') => {
    e.preventDefault()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file && file.name.toLowerCase().endsWith('.csv')) {
        handleFileUpload(file, importType)
      } else {
        alert(t('selectCsvFile'))
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Commitments & Actuals import */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('commitmentsActualsHeading')}</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-slate-400">
            <FileText className="h-4 w-4" />
            <span>{t('formatSpreadsheet')}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Commitments Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-gray-800 dark:text-slate-200">{t('commitmentsLabel')}</h4>
              <button
                onClick={() => downloadTemplate('commitments')}
                className="flex items-center px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 rounded hover:bg-blue-200"
              >
                <Download className="h-4 w-4 mr-1" />
                {t('template')}
              </button>
            </div>
            
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-slate-600 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'commitments')}
            >
              <Upload className="h-8 w-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                {t('dropzoneFilePrompt')}
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file, 'commitments')
                }}
                className="hidden"
                id="commitments-upload"
              />
              <label
                htmlFor="commitments-upload"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('selectFile')}
              </label>
            </div>
            
            <div className="text-xs text-gray-500 dark:text-slate-400">
              <p>• {t('maxFileSize')}</p>
              <p>• {t('columnsCommitments')}</p>
            </div>
          </div>

          {/* Actuals Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-gray-800 dark:text-slate-200">{t('actualsLabel')}</h4>
              <button
                onClick={() => downloadTemplate('actuals')}
                className="flex items-center px-3 py-1 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 rounded hover:bg-green-200"
              >
                <Download className="h-4 w-4 mr-1" />
                {t('template')}
              </button>
            </div>
            
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-slate-600 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'actuals')}
            >
              <Upload className="h-8 w-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                {t('dropzoneFilePrompt')}
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file, 'actuals')
                }}
                className="hidden"
                id="actuals-upload"
              />
              <label
                htmlFor="actuals-upload"
                className="inline-flex items-center px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-700 cursor-pointer"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('selectFile')}
              </label>
            </div>
            
            <div className="text-xs text-gray-500 dark:text-slate-400">
              <p>• {t('maxFileSize')}</p>
              <p>• {t('columnsActuals')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadingFile && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-800 dark:text-blue-300">{t('processingFile')}</span>
          </div>
        </div>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div className={`border rounded-lg p-4 ${
          uploadResult.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}
        >
          <div className="flex items-start">
            {uploadResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-3 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className={`font-medium ${
                uploadResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
              }`}
              >
                {uploadResult.success ? t('importSuccess') : t('importFailed')}
              </h4>
              
              <div className="mt-2 text-sm">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-gray-600 dark:text-slate-400">{t('processed')}:</span>
                    <span className="font-medium ml-1">{uploadResult.records_processed}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-slate-400">{t('imported')}:</span>
                    <span className="font-medium ml-1 text-green-600 dark:text-green-400">{uploadResult.records_imported}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-slate-400">{t('errorLabel')}:</span>
                    <span className="font-medium ml-1 text-red-600 dark:text-red-400">{uploadResult.errors.length}</span>
                  </div>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">{t('errorLabel')}:</h5>
                  <div className="max-h-32 overflow-y-auto">
                    {uploadResult.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-xs text-red-700 mb-1">
                        {t('rowLabel', { row: error.row })}: {typeof error.message === 'string' ? error.message : JSON.stringify(error.message)}
                      </div>
                    ))}
                    {uploadResult.errors.length > 5 && (
                      <div className="text-xs text-red-600 dark:text-red-400">
                        {t('moreErrors', { count: uploadResult.errors.length - 5 })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {uploadResult.warnings.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">{t('warnings')}:</h5>
                  <div className="max-h-32 overflow-y-auto">
                    {uploadResult.warnings.slice(0, 3).map((warning, index) => (
                      <div key={index} className="text-xs text-yellow-700 mb-1">
                        {t('rowLabel', { row: warning.row })}: {typeof warning.message === 'string' ? warning.message : JSON.stringify(warning.message)}
                      </div>
                    ))}
                    {uploadResult.warnings.length > 3 && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400">
                        {t('moreWarnings', { count: uploadResult.warnings.length - 3 })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import History */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('importHistory')}</h3>
            <button
              onClick={fetchCSVImportHistory}
              className="flex items-center px-3 py-1 text-sm bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded hover:bg-gray-200 dark:hover:bg-slate-600"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('refresh')}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('type')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('file')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('records')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('date')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('size')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {csvImportHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                    <History className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-slate-500" />
                    {t('noImportsYet')}
                  </td>
                </tr>
              ) : (
                csvImportHistory.map((importRecord) => (
                  <tr key={importRecord.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        importRecord.import_type === 'commitments' 
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' 
                          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      }`}
                      >
                        {importRecord.import_type === 'projects'
                          ? t('projects')
                          : importRecord.import_type === 'commitments'
                            ? t('commitmentsShort')
                            : t('actualsShort')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                      {importRecord.file_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {importRecord.import_status === 'completed' ? (
                          <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-1" />
                        ) : importRecord.import_status === 'failed' ? (
                          <XCircle className="h-4 w-4 text-red-500 dark:text-red-400 mr-1" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-500 dark:text-yellow-400 mr-1" />
                        )}
                        <span className={`text-sm ${
                          importRecord.import_status === 'completed' ? 'text-green-800 dark:text-green-300' :
                          importRecord.import_status === 'failed' ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'
                        }`}
                        >
                          {importRecord.import_status === 'completed' ? t('completed') :
                           importRecord.import_status === 'failed' ? t('failed') : t('inProgress')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600 dark:text-green-400">{importRecord.records_imported}</span>
                        <span className="text-gray-400 dark:text-slate-500">/</span>
                        <span>{importRecord.records_processed}</span>
                        {importRecord.records_failed > 0 && (
                          <>
                            <span className="text-gray-400 dark:text-slate-500">•</span>
                            <span className="text-red-600 dark:text-red-400">{importRecord.records_failed} {t('errorCount')}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                      {new Date(importRecord.started_at).toLocaleString('de-DE')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                      {(importRecord.file_size / 1024).toFixed(1)} KB
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}