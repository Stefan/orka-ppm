'use client'

import React from 'react'
import { Search, Filter, X, Calendar, DollarSign } from 'lucide-react'
import { TransactionFilters as FilterType, TransactionSortField, SortDirection } from '@/lib/costbook/transaction-queries'
import { POStatus, ActualStatus } from '@/types/costbook'

export interface TransactionFiltersProps {
  /** Current filter values */
  filters: FilterType
  /** Handler for filter changes */
  onFilterChange: (filters: FilterType) => void
  /** Current sort field */
  sortField?: TransactionSortField
  /** Current sort direction */
  sortDirection?: SortDirection
  /** Handler for sort changes */
  onSortChange?: (field: TransactionSortField, direction: SortDirection) => void
  /** Available projects for dropdown */
  projects?: Array<{ id: string; name: string }>
  /** Show compact version */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * TransactionFilters component for filtering and sorting transactions
 */
export function TransactionFilters({
  filters,
  onFilterChange,
  sortField = 'date',
  sortDirection = 'desc',
  onSortChange,
  projects = [],
  compact = false,
  className = '',
  'data-testid': testId = 'transaction-filters'
}: TransactionFiltersProps) {
  const hasActiveFilters = 
    filters.projectId ||
    filters.vendorName ||
    (filters.type && filters.type !== 'all') ||
    (filters.status && filters.status !== 'all') ||
    filters.startDate ||
    filters.endDate ||
    filters.minAmount !== undefined ||
    filters.maxAmount !== undefined ||
    filters.searchTerm

  const handleClearFilters = () => {
    onFilterChange({})
  }

  const updateFilter = <K extends keyof FilterType>(key: K, value: FilterType[K]) => {
    onFilterChange({ ...filters, [key]: value || undefined })
  }

  if (compact) {
    return (
      <div 
        className={`flex items-center gap-2 ${className}`}
        data-testid={testId}
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={filters.searchTerm || ''}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            placeholder="Search transactions..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Type Filter */}
        <select
          value={filters.type || 'all'}
          onChange={(e) => updateFilter('type', e.target.value as 'commitment' | 'actual' | 'all')}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Types</option>
          <option value="commitment">Commitments</option>
          <option value="actual">Actuals</option>
        </select>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="p-2 text-gray-600 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-md"
            title="Clear filters"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div 
      className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 ${className}`}
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          <h3 className="font-medium text-gray-900 dark:text-slate-100">Filters</h3>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 rounded-full">
              Active
            </span>
          )}
        </div>
        
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={filters.searchTerm || ''}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              placeholder="Search by description, vendor, PO..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid={`${testId}-search`}
            />
          </div>
        </div>

        {/* Project */}
        {projects.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              Project
            </label>
            <select
              value={filters.projectId || ''}
              onChange={(e) => updateFilter('projectId', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid={`${testId}-project`}
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
            Type
          </label>
          <select
            value={filters.type || 'all'}
            onChange={(e) => updateFilter('type', e.target.value as 'commitment' | 'actual' | 'all')}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid={`${testId}-type`}
          >
            <option value="all">All Types</option>
            <option value="commitment">Commitments Only</option>
            <option value="actual">Actuals Only</option>
          </select>
        </div>

        {/* Vendor */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
            Vendor
          </label>
          <input
            type="text"
            value={filters.vendorName || ''}
            onChange={(e) => updateFilter('vendorName', e.target.value)}
            placeholder="Filter by vendor..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid={`${testId}-vendor`}
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
            <Calendar className="w-3 h-3 inline mr-1" />
            Start Date
          </label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => updateFilter('startDate', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid={`${testId}-start-date`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
            <Calendar className="w-3 h-3 inline mr-1" />
            End Date
          </label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => updateFilter('endDate', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid={`${testId}-end-date`}
          />
        </div>

        {/* Amount Range */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
            <DollarSign className="w-3 h-3 inline mr-1" />
            Min Amount
          </label>
          <input
            type="number"
            value={filters.minAmount ?? ''}
            onChange={(e) => updateFilter('minAmount', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid={`${testId}-min-amount`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
            <DollarSign className="w-3 h-3 inline mr-1" />
            Max Amount
          </label>
          <input
            type="number"
            value={filters.maxAmount ?? ''}
            onChange={(e) => updateFilter('maxAmount', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="No limit"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid={`${testId}-max-amount`}
          />
        </div>
      </div>

      {/* Sort Controls */}
      {onSortChange && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center gap-4">
          <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Sort by:</span>
          
          <select
            value={sortField}
            onChange={(e) => onSortChange(e.target.value as TransactionSortField, sortDirection)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="vendor_name">Vendor</option>
            <option value="type">Type</option>
            <option value="status">Status</option>
          </select>

          <select
            value={sortDirection}
            onChange={(e) => onSortChange(sortField, e.target.value as SortDirection)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      )}
    </div>
  )
}

export default TransactionFilters