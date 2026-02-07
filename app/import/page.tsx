'use client'

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import dynamic from 'next/dynamic'
import AppLayout from '../../components/shared/AppLayout'
import { Upload } from 'lucide-react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { getApiUrl } from '@/lib/api'
import { useTranslations } from '@/lib/i18n/context'
import { GuidedTour, useGuidedTour, TourTriggerButton, importTourSteps } from '@/components/guided-tour'

const CSVImportView = dynamic(
  () => import('@/app/financials/components/views/CSVImportView'),
  { ssr: false, loading: () => <div className="animate-pulse h-48 bg-gray-200 dark:bg-slate-700 rounded-lg" /> }
)

interface ImportError {
  line_number: number
  field: string
  message: string
  value: any
}

interface ImportResult {
  success_count: number
  error_count: number
  errors: ImportError[]
  processing_time_seconds: number
}

export default function ImportPage() {
  const { session } = useAuth()
  const t = useTranslations('dataImport')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { isOpen, startTour, closeTour, completeTour, resetAndStartTour, hasCompletedTour } = useGuidedTour('import-v1')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json']
    },
    maxFiles: 1,
    multiple: false
  })

  const handleUpload = async () => {
    if (!selectedFile || !session?.access_token) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('entity_type', 'projects')

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch(getApiUrl('/api/projects/import'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.message || errorData.detail || 'Upload failed')
      }

      const data: ImportResult = await response.json()
      setResult(data)

      if (data.error_count === 0) {
        setSelectedFile(null)
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }

  const downloadErrorReport = () => {
    if (!result || result.errors.length === 0) return

    const csvContent = [
      ['Line Number', 'Field', 'Error Message', 'Value'],
      ...result.errors.map(err => [
        err.line_number,
        err.field,
        err.message,
        err.value || ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `import-errors-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <AppLayout>
      <div data-testid="import-page" className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div data-testid="import-header" className="mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 data-testid="import-title" className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">{t('title')}</h1>
              <p className="text-gray-700 dark:text-slate-300">
                {t('subtitle')}
              </p>
            </div>
            <TourTriggerButton
              onStart={hasCompletedTour ? resetAndStartTour : startTour}
              hasCompletedTour={hasCompletedTour}
            />
          </div>

          {/* 1. Import Projects */}
          <div data-testid="import-interface" data-tour="import-mapping" className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('projects')}</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              {t('projectsDescription')}
            </p>
            <div data-tour="import-preview" className="mt-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className={`h-12 w-12 mx-auto mb-4 ${
                  isDragActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'
                }`} />
                {selectedFile ? (
                  <div>
                    <p className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-1">{selectedFile.name}</p>
                    <p className="text-sm text-gray-700 dark:text-slate-300">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-700 dark:text-slate-300 mb-2">
                      {isDragActive ? t('dropzoneActive') : t('dropzonePrompt')}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-slate-300">{t('acceptedFormats')}</p>
                  </div>
                )}
              </div>

              {selectedFile && (
                <div className="mt-4 flex gap-3" data-tour="import-start">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {uploading ? t('processing') : t('importButton')}
                  </button>
                  <button
                    onClick={() => setSelectedFile(null)}
                    disabled={uploading}
                    className="px-6 py-3 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-slate-100 rounded-lg hover:bg-gray-50 dark:bg-slate-800/50 disabled:opacity-50"
                  >
                    {t('clear')}
                  </button>
                </div>
              )}
            </div>

            {uploading && (
              <div className="mt-4 flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('processing')}</span>
                <span className="text-sm text-gray-700 dark:text-slate-300">{uploadProgress}%</span>
              </div>
            )}
            {uploading && (
              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">{t('importFailed')}</h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
              </div>
            )}

            {result && (
              <div className="mt-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('results')}</h3>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <div className="text-xl font-bold text-green-700 dark:text-green-400">{result.success_count}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">{t('imported')}</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="text-xl font-bold text-red-700 dark:text-red-400">{result.error_count}</div>
                    <div className="text-xs text-red-600 dark:text-red-400">{t('errors')}</div>
                  </div>
                </div>
                <p className="text-xs text-gray-700 dark:text-slate-300 mb-3">
                  {t('processingTime', { seconds: result.processing_time_seconds.toFixed(2) })}
                </p>
                {result.errors.length > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{t('validationErrors')}</span>
                    <button
                      onClick={downloadErrorReport}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                    >
                      {t('downloadReport')}
                    </button>
                  </div>
                )}
                {result.error_count === 0 && (
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">{t('allSuccess')}</p>
                )}
              </div>
            )}
          </div>

          {/* Commitments & Actuals */}
          <div data-testid="import-csv-view">
            <CSVImportView accessToken={session?.access_token} />
          </div>
        </div>
      </div>
      <GuidedTour
        steps={importTourSteps}
        isOpen={isOpen}
        onClose={closeTour}
        onComplete={completeTour}
        tourId="import-v1"
      />
    </AppLayout>
  )
}
