'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import AppLayout from '../../components/shared/AppLayout'
import { Upload, FileText, Database, DollarSign } from 'lucide-react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { useFeatureFlag } from '@/contexts/FeatureFlagContext'
import { useRouter } from 'next/navigation'

type EntityType = 'projects' | 'resources' | 'financials'

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
  const router = useRouter()
  const { enabled: importEnabled } = useFeatureFlag('import_builder_ai')

  // Redirect if feature is disabled
  useEffect(() => {
    if (!importEnabled) {
      router.push('/')
    }
  }, [importEnabled, router])

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [entityType, setEntityType] = useState<EntityType>('projects')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // File drop handler
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

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile || !session?.access_token) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)
    setResult(null)

    try {
      // Create form data
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('entity_type', entityType)

      // Simulate progress (since we can't track actual upload progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      // Upload to backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/import`, {
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

      // Clear file if successful
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

  // Download error report
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

  const entityTypeOptions = [
    { value: 'projects', label: 'Projects', icon: FileText, description: 'Import project data' },
    { value: 'resources', label: 'Resources', icon: Database, description: 'Import resource allocations' },
    { value: 'financials', label: 'Financials', icon: DollarSign, description: 'Import financial records' }
  ]

  return (
    <AppLayout>
      <div data-testid="import-page" className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div data-testid="import-header" className="mb-8">
            <h1 data-testid="import-title" className="text-3xl font-bold text-gray-900 mb-2">Bulk Import</h1>
            <p className="text-gray-600">
              Import multiple records from CSV or JSON files
            </p>
          </div>

          {/* Entity Type Selector */}
          <div data-testid="import-interface" className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Select Entity Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {entityTypeOptions.map(option => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={() => setEntityType(option.value as EntityType)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      entityType === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`h-8 w-8 mb-2 ${
                      entityType === option.value ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <div className="text-left">
                      <div className="font-semibold">{option.label}</div>
                      <div className="text-sm text-gray-500">{option.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* File Upload Dropzone */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Upload File</h2>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className={`h-12 w-12 mx-auto mb-4 ${
                isDragActive ? 'text-blue-500' : 'text-gray-400'
              }`} />
              {selectedFile ? (
                <div>
                  <p className="text-lg font-medium text-gray-900 mb-1">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-700 mb-2">
                    {isDragActive
                      ? 'Drop file here...'
                      : 'Drag & drop CSV or JSON file, or click to select'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Supported formats: .csv, .json
                  </p>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {uploading ? 'Uploading...' : 'Import Data'}
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  disabled={uploading}
                  className="px-6 py-3 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Processing...</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Import Failed</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success/Error Results */}
          {result && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Import Results</h2>
              
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">{result.success_count}</div>
                  <div className="text-sm text-green-600">Records Imported</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-700">{result.error_count}</div>
                  <div className="text-sm text-red-600">Errors</div>
                </div>
              </div>

              <div className="text-sm text-gray-500 mb-4">
                Processing time: {result.processing_time_seconds.toFixed(2)}s
              </div>

              {/* Validation Errors */}
              {result.errors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Validation Errors</h3>
                    <button
                      onClick={downloadErrorReport}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Download Error Report
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {result.errors.map((err, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{err.line_number}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{err.field}</td>
                              <td className="px-4 py-3 text-sm text-red-600">{err.message}</td>
                              <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">
                                {err.value !== null && err.value !== undefined ? String(err.value) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {result.error_count === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-green-800">
                      All records imported successfully!
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
