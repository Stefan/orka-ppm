'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import dynamic from 'next/dynamic'
import AppLayout from '../../components/shared/AppLayout'
import { Upload } from 'lucide-react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { getApiUrl } from '@/lib/api'
import { useTranslations } from '@/lib/i18n/context'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { GuidedTour, useGuidedTour, TourTriggerButton, importTourSteps } from '@/components/guided-tour'

const NAME_KEYS = ['name', 'project_nr', 'project_name', 'projectName', 'title', 'project', 'project_number', 'projectNumber', 'description']
function pickName(obj: Record<string, unknown>): string | undefined {
  for (const k of NAME_KEYS) {
    const v = obj[k]
    if (v != null && typeof v === 'string') return v
  }
  const id = obj.id ?? obj.project_id
  if (id != null) return String(id)
  return undefined
}

const PPM_STATUS_TO_APP: Record<number, string> = {
  0: 'planning',
  1: 'completed',
  2: 'on-hold',
  4: 'cancelled',
  5: 'planning',
  6: 'active'
}
function normalizeStatus(item: Record<string, unknown>): string {
  const s = item.status
  if (s != null && typeof s === 'string' && ['planning', 'active', 'on-hold', 'completed', 'cancelled'].includes(s)) return s
  const id = item.projectStatusId as number | undefined
  if (id != null && PPM_STATUS_TO_APP[id] != null) return PPM_STATUS_TO_APP[id]
  const desc = (item.projectStatusDescription as string)?.toLowerCase()
  if (desc?.includes('complete')) return 'completed'
  if (desc?.includes('hold')) return 'on-hold'
  if (desc?.includes('cancel')) return 'cancelled'
  if (desc?.includes('active')) return 'active'
  return 'planning'
}

function normalizeProjectForApi(item: Record<string, unknown>, defaultPortfolioId: string | null, index: number): Record<string, unknown> {
  const name = pickName(item) ?? `Project ${index + 1}`
  const portfolio_id = (item.portfolio_id as string) ?? defaultPortfolioId ?? null
  const startRaw = item.start_date ?? item.start ?? item.startDate
  const endRaw = item.end_date ?? item.end ?? item.finishDate
  const startStr = startRaw != null ? String(startRaw).slice(0, 10) : null
  const endStr = endRaw != null ? String(endRaw).slice(0, 10) : null
  return {
    portfolio_id,
    name,
    description: item.description ?? item.desc ?? null,
    budget: item.budget ?? item.budget_amount ?? null,
    status: normalizeStatus(item),
    start_date: startStr || null,
    end_date: endStr || null,
    priority: item.priority ?? null,
    program_id: item.program_id ?? null,
    manager_id: item.manager_id ?? null,
    team_members: item.team_members ?? []
  }
}

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
  const { portfolios: contextPortfolios, setPortfolios: setContextPortfolios } = usePortfolio()
  const t = useTranslations('dataImport')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localPortfolios, setLocalPortfolios] = useState<{ id: string; name: string }[]>([])
  const [defaultPortfolioId, setDefaultPortfolioId] = useState<string>('')
  const [anonymize, setAnonymize] = useState(true)
  const [clearBeforeImport, setClearBeforeImport] = useState(false)
  const { isOpen, startTour, closeTour, completeTour, resetAndStartTour, hasCompletedTour } = useGuidedTour('import-v1')

  const portfolios = contextPortfolios.length > 0
    ? contextPortfolios.map(p => ({ id: p.id, name: p.name }))
    : localPortfolios

  useEffect(() => {
    if (portfolios.length > 0 && !defaultPortfolioId) {
      setDefaultPortfolioId(portfolios[0].id)
    }
  }, [portfolios.length, portfolios[0]?.id, defaultPortfolioId])

  useEffect(() => {
    if (!session?.access_token) return
    fetch('/api/portfolios', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(res => {
        if (!res.ok) return res.json().catch(() => []).then(() => [] as unknown)
        return res.json()
      })
      .then((data: unknown) => {
        const list = Array.isArray(data)
          ? data
          : (data as { items?: unknown[]; portfolios?: unknown[] })?.items
            ?? (data as { portfolios?: unknown[] })?.portfolios
            ?? []
        const mapped = (list as { id?: string; name?: string; description?: string; owner_id?: string }[])
          .map(p => ({ id: p.id ?? '', name: p.name ?? '' }))
          .filter(p => p.id)
        const forContext = (list as { id?: string; name?: string; description?: string; owner_id?: string }[])
          .filter(p => p.id)
          .map(p => ({
            id: p.id!,
            name: p.name ?? '',
            description: p.description ?? null,
            owner_id: p.owner_id ?? '',
          }))
        setLocalPortfolios(mapped)
        if (forContext.length > 0) setContextPortfolios(forContext)
        setDefaultPortfolioId(prev => prev || (mapped[0]?.id ?? ''))
      })
      .catch(() => setLocalPortfolios([]))
  }, [session?.access_token, setContextPortfolios])

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
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const isJson = selectedFile.name.toLowerCase().endsWith('.json')
      let response: Response

      if (isJson) {
        const text = await selectedFile.text()
        let raw: unknown
        try {
          raw = JSON.parse(text)
        } catch {
          throw new Error('Invalid JSON in file')
        }
        if (!Array.isArray(raw)) {
          throw new Error('JSON file must contain an array of projects')
        }
        const projects = raw.map((item: Record<string, unknown>, index: number) =>
          normalizeProjectForApi(item, defaultPortfolioId || null, index)
        )
        const params = new URLSearchParams()
        params.set('anonymize', String(anonymize))
        params.set('clear_before_import', String(clearBeforeImport))
        response = await fetch(`${getApiUrl('/api/projects/import')}?${params.toString()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(projects)
        })
      } else {
        throw new Error('Project CSV import: use the Projects page and click Import, then choose CSV and a portfolio.')
      }

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const detail = errorData.detail

        // Backend returns 400 with ImportResult shape { success, count, errors, message }
        const isImportResult =
          detail &&
          typeof detail === 'object' &&
          Array.isArray((detail as { errors?: unknown }).errors)
        if (isImportResult) {
          const d = detail as { count?: number; errors?: { index?: number; field?: string; error?: string; message?: string; value?: unknown }[]; message?: string }
          const resultData: ImportResult = {
            success_count: d.count ?? 0,
            error_count: d.errors?.length ?? 0,
            errors: (d.errors ?? []).map((e) => ({
              line_number: (e.index ?? 0) + 1,
              field: e.field ?? 'unknown',
              message: e.error ?? e.message ?? 'Error',
              value: e.value
            })),
            processing_time_seconds: 0
          }
          setResult(resultData)
          setError(d.message ?? 'Validation failed')
          return
        }

        let message: string
        if (typeof detail === 'string') {
          message = detail
        } else if (detail?.message) {
          message = String(detail.message)
        } else if (Array.isArray(detail) && detail.length > 0) {
          const maxShow = 5
          const parts = detail.slice(0, maxShow).map((e: { loc?: (string | number)[]; msg?: string; message?: string }) => {
            const loc = e.loc
            const row = Array.isArray(loc) && typeof loc[1] === 'number' ? loc[1] + 1 : ''
            const field = Array.isArray(loc) && loc.length > 2 ? String(loc[loc.length - 1]) : 'item'
            const msg = e?.msg ?? e?.message ?? 'Validation error'
            return row ? `Row ${row} (${field}): ${msg}` : `${field}: ${msg}`
          })
          message = parts.join('. ')
          if (detail.length > maxShow) {
            message += ` (and ${detail.length - maxShow} more). `
          }
          message += ' Required: each project needs "name" (string). "portfolio_id" is optional.'
        } else if (detail && typeof detail === 'object') {
          message = (detail as { message?: string }).message ?? JSON.stringify(detail)
        } else {
          message = 'Upload failed'
        }
        throw new Error(message)
      }

      const data = await response.json()
      const resultData: ImportResult = {
        success_count: data.count ?? 0,
        error_count: Array.isArray(data.errors) ? data.errors.length : 0,
        errors: Array.isArray(data.errors)
          ? data.errors.map((e: { index?: number; field?: string; error?: string; message?: string; value?: unknown }) => ({
              line_number: (e.index ?? 0) + 1,
              field: e.field ?? 'unknown',
              message: e.error ?? e.message ?? 'Error',
              value: e.value
            }))
          : [],
        processing_time_seconds: 0
      }
      setResult(resultData)

      if (resultData.error_count === 0) {
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
            <div className="flex flex-wrap gap-6 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={anonymize}
                  onChange={e => setAnonymize(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-500 text-blue-600 focus:ring-blue-500"
                />
                <span>{t('anonymizeData')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={clearBeforeImport}
                  onChange={e => setClearBeforeImport(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-500 text-blue-600 focus:ring-blue-500"
                />
                <span>{t('clearBeforeImport')}</span>
              </label>
            </div>
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

              {selectedFile && selectedFile.name.toLowerCase().endsWith('.json') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {t('assignToPortfolio')} <span className="text-gray-500 dark:text-slate-400 font-normal">({t('optional')})</span>
                  </label>
                  <select
                    value={defaultPortfolioId}
                    onChange={e => setDefaultPortfolioId(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 px-3 py-2"
                    data-testid="import-portfolio-select"
                  >
                    <option value="">{t('noPortfolio')}</option>
                    {portfolios.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{t('validationErrors')}</span>
                      <button
                        onClick={downloadErrorReport}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                      >
                        {t('downloadReport')}
                      </button>
                    </div>
                    <ul className="text-left text-sm text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded-lg divide-y divide-gray-200 dark:divide-slate-600 max-h-48 overflow-y-auto mb-2">
                      {result.errors.slice(0, 15).map((err, i) => (
                        <li key={i} className="px-3 py-2">
                          <span className="font-medium">Row {err.line_number}</span>
                          {err.field !== 'unknown' && <span className="text-gray-500 dark:text-slate-400"> ({err.field})</span>}
                          : {err.message}
                        </li>
                      ))}
                      {result.errors.length > 15 && (
                        <li className="px-3 py-2 text-gray-500 dark:text-slate-400">
                          … and {result.errors.length - 15} more — {t('downloadReport')} for full list.
                        </li>
                      )}
                    </ul>
                  </>
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
