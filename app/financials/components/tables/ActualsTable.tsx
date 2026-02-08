'use client'

import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter
} from 'lucide-react'
import { getApiUrl } from '../../../../lib/api'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { useTranslations } from '@/lib/i18n/context'
import type { SavedViewDefinition } from '@/lib/saved-views-api'

interface Actual {
  id: string
  fi_doc_no: string
  posting_date: string
  document_date?: string
  vendor: string
  vendor_description?: string
  project_nr: string
  wbs_element?: string
  amount: number
  currency: string
  item_text?: string
  document_type?: string
  created_at: string
  updated_at: string
  [key: string]: any // For additional columns
}

interface ActualsTableProps {
  accessToken: string | undefined
  onProjectClick?: (projectNr: string) => void
  initialView?: SavedViewDefinition | null
  onDefinitionChange?: (def: SavedViewDefinition) => void
}

type SortDirection = 'asc' | 'desc' | null
type SortField = keyof Actual | null

const ActualsTable = forwardRef<{ refresh: () => void }, ActualsTableProps>(({ accessToken, onProjectClick, initialView, onDefinitionChange }, ref) => {
  const t = useTranslations('financials')
  const { formatDate } = useDateFormatter()
  const [actuals, setActuals] = useState<Actual[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
  // Filtering state
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [showFilters, setShowFilters] = useState(false)

  // Fetch actuals data
  const fetchActuals = async () => {
    if (!accessToken) return
    
    setLoading(true)
    setError(null)
    
    try {
      const offset = (currentPage - 1) * pageSize
      const countExact = currentPage === 1
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) })
      if (countExact) params.set('count_exact', 'true')
      const response = await fetch(
        getApiUrl(`/csv-import/actuals?${params.toString()}`),
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setActuals(data.actuals || [])
        setTotal(data.total ?? 0)
      } else {
        const errorData = await response.json()
        setError(errorData.detail || 'Failed to fetch actuals')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch actuals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => fetchActuals(), 100)
    return () => clearTimeout(t)
  }, [accessToken, currentPage, pageSize])

  useEffect(() => {
    if (!initialView) return
    if (initialView.filters && Object.keys(initialView.filters).length > 0) {
      setFilters(initialView.filters as Record<string, string>)
    }
    if (initialView.sortBy) setSortField(initialView.sortBy as SortField)
    if (initialView.sortOrder === 'asc' || initialView.sortOrder === 'desc') setSortDirection(initialView.sortOrder)
    if (initialView.pageSize != null && initialView.pageSize >= 1) setPageSize(initialView.pageSize)
  }, [initialView])

  useEffect(() => {
    onDefinitionChange?.({
      filters: Object.keys(filters).length ? filters : undefined,
      sortBy: sortField ?? undefined,
      sortOrder: sortDirection ?? undefined,
      pageSize,
    })
  }, [filters, sortField, sortDirection, pageSize, onDefinitionChange])

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: fetchActuals
  }))

  // Apply client-side filtering and sorting
  const filteredAndSortedActuals = useMemo(() => {
    let result = [...actuals]
    
    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter(actual => {
          const fieldValue = actual[field]
          if (fieldValue === null || fieldValue === undefined) return false
          return String(fieldValue).toLowerCase().includes(value.toLowerCase())
        })
      }
    })
    
    // Apply sorting
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        const aValue = a[sortField]
        const bValue = b[sortField]
        
        if (aValue === null || aValue === undefined) return 1
        if (bValue === null || bValue === undefined) return -1
        
        let comparison = 0
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue
        } else {
          comparison = String(aValue).localeCompare(String(bValue))
        }
        
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }
    
    return result
  }, [actuals, filters, sortField, sortDirection])

  // Handle sort
  const handleSort = (field: keyof Actual) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc')
      if (sortDirection === 'desc') {
        setSortField(null)
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Handle filter change
  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Column definitions (used for table headers and CSV export)
  const columns: Array<{
    key: keyof Actual
    labelKey: string
    width?: string
    format?: (value: any) => string
  }> = [
    { key: 'fi_doc_no', labelKey: 'columns.fiDocNo', width: 'w-32' },
    { key: 'posting_date', labelKey: 'columns.postingDate', width: 'w-28', format: (v) => v ? formatDate(new Date(v)) : '' },
    { key: 'document_date', labelKey: 'columns.documentDate', width: 'w-28', format: (v) => v ? formatDate(new Date(v)) : '' },
    { key: 'vendor', labelKey: 'columns.vendor', width: 'w-32' },
    { key: 'vendor_description', labelKey: 'columns.vendorDescription', width: 'w-48' },
    { key: 'project_nr', labelKey: 'columns.projectNr', width: 'w-28' },
    { key: 'wbs_element', labelKey: 'columns.wbsElement', width: 'w-32' },
    { key: 'amount', labelKey: 'columns.amount', width: 'w-28', format: (v) => v?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00' },
    { key: 'currency', labelKey: 'columns.currency', width: 'w-20' },
    { key: 'item_text', labelKey: 'columns.itemText', width: 'w-48' },
    { key: 'document_type', labelKey: 'columns.documentType', width: 'w-28' },
  ]

  // Export to CSV
  const exportToCSV = () => {
    const headers = columns.map(c => t(c.labelKey as any))
    const rows = filteredAndSortedActuals.map(actual =>
      columns.map(col => {
        const v = actual[col.key]
        return col.format ? col.format(v) : (v ?? '')
      })
    )
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `actuals_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Pagination helpers
  const totalPages = Math.ceil(total / pageSize)
  const startRecord = (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, total)

  // Render sort icon
  const renderSortIcon = (field: keyof Actual) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-gray-400 dark:text-slate-500" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-3 w-3 text-blue-600 dark:text-blue-400" />
    }
    return <ArrowUpDown className="h-3 w-3 text-gray-400 dark:text-slate-500" />
  }

  if (loading && actuals.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-slate-400">Loading actuals...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8">
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="font-medium">Error loading actuals</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchActuals}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No Actuals Data</h3>
          <p className="text-gray-600 dark:text-slate-400 mb-4">
            No actual records have been imported yet.
          </p>
          <a
            href="#csv-import"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to CSV Import
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('actualsData')}</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {t('showingRecords', { start: startRecord, end: endRecord, total })}
              {Object.keys(filters).some(k => filters[k]) && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  {t('filteredCount', { count: filteredAndSortedActuals.length })}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showFilters 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              <Filter className="h-4 w-4 mr-1" />
              {t('filters')}
            </button>
            
            <button
              onClick={exportToCSV}
              className="flex items-center px-3 py-2 bg-green-700 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <Download className="h-4 w-4 mr-1" />
              {t('export')}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider ${column.width || ''}`}
                  >
                    <button
                      onClick={() => handleSort(column.key)}
                      className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300"
                    >
                      <span>{t(column.labelKey as any)}</span>
                      {renderSortIcon(column.key)}
                    </button>
                  </th>
                ))}
              </tr>
              
              {/* Filter row */}
              {showFilters && (
                <tr className="bg-gray-100 dark:bg-slate-700">
                  {columns.map((column) => (
                    <th key={`filter-${String(column.key)}`} className="px-4 py-2">
                      <input
                        type="text"
                        placeholder={`${t(column.labelKey as any)}...`}
                        value={filters[String(column.key)] || ''}
                        onChange={(e) => handleFilterChange(String(column.key), e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {filteredAndSortedActuals.map((actual) => (
                <tr key={actual.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                  {columns.map((column) => (
                    <td
                      key={`${actual.id}-${String(column.key)}`}
                      className="px-4 py-3 text-sm text-gray-900 dark:text-slate-100 whitespace-nowrap"
                    >
                      {column.key === 'project_nr' && onProjectClick ? (
                        <button
                          onClick={() => onProjectClick(actual.project_nr)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                        >
                          {actual[column.key] || '-'}
                        </button>
                      ) : (
                        <span>
                          {column.format 
                            ? column.format(actual[column.key])
                            : actual[column.key] || '-'
                          }
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 dark:text-slate-300">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

ActualsTable.displayName = 'ActualsTable'

export default ActualsTable
