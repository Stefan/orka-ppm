'use client'

import React, { useState, useCallback, useDeferredValue } from 'react'
import { Search, Filter, X, TrendingUp } from 'lucide-react'
import { useDebounce } from '../../hooks/useDebounce'

export interface FilterConfig {
  searchTerm: string
  dateRange: {
    start: Date | null
    end: Date | null
  }
  valueRange: [number, number]
  categories: string[]
  sortBy: 'name' | 'value' | 'timestamp'
  sortOrder: 'asc' | 'desc'
  showOutliers: boolean
  aggregation: 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly'
}

interface ChartFiltersProps {
  filters: FilterConfig
  onFiltersChange: (filters: FilterConfig) => void
  availableCategories: string[]
  dataRange: {
    minValue: number
    maxValue: number
    minDate: Date
    maxDate: Date
  }
  className?: string
}

const ChartFilters: React.FC<ChartFiltersProps> = ({
  filters,
  onFiltersChange,
  availableCategories,
  dataRange,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Debounce search term to reduce update frequency (300ms delay)
  const debouncedSearchTerm = useDebounce(filters.searchTerm, 300)
  
  // Defer non-critical filter updates (categories, date range, value range)
  const deferredCategories = useDeferredValue(filters.categories)
  const deferredDateRange = useDeferredValue(filters.dateRange)
  const deferredValueRange = useDeferredValue(filters.valueRange)

  const updateFilter = useCallback((key: keyof FilterConfig, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }, [filters, onFiltersChange])

  const resetFilters = useCallback(() => {
    onFiltersChange({
      searchTerm: '',
      dateRange: { start: null, end: null },
      valueRange: [dataRange.minValue, dataRange.maxValue],
      categories: [],
      sortBy: 'name',
      sortOrder: 'asc',
      showOutliers: true,
      aggregation: 'none'
    })
  }, [onFiltersChange, dataRange])

  const formatDate = (date: Date | null) => {
    return date ? date.toISOString().split('T')[0] : ''
  }

  const parseDate = (dateString: string) => {
    return dateString ? new Date(dateString) : null
  }

  return (
    <div className={`bg-gray-50 border-b border-gray-200 ${className}`}>
      {/* Filter Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-600" />
          <span className="font-medium text-gray-900">Filters</span>
          {(filters.searchTerm || filters.categories.length > 0 || 
            filters.dateRange.start || filters.dateRange.end) && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              Active
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={resetFilters}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Reset
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-600 hover:text-gray-900"
          >
            {isExpanded ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                placeholder="Search data points..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={formatDate(filters.dateRange.start)}
                  onChange={(e) => updateFilter('dateRange', {
                    ...filters.dateRange,
                    start: parseDate(e.target.value)
                  })}
                  min={formatDate(dataRange.minDate)}
                  max={formatDate(dataRange.maxDate)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={formatDate(filters.dateRange.end)}
                  onChange={(e) => updateFilter('dateRange', {
                    ...filters.dateRange,
                    end: parseDate(e.target.value)
                  })}
                  min={formatDate(dataRange.minDate)}
                  max={formatDate(dataRange.maxDate)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Value Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value Range
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  value={filters.valueRange[0]}
                  onChange={(e) => updateFilter('valueRange', [
                    parseFloat(e.target.value),
                    filters.valueRange[1]
                  ])}
                  min={dataRange.minValue}
                  max={dataRange.maxValue}
                  step="0.01"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  value={filters.valueRange[1]}
                  onChange={(e) => updateFilter('valueRange', [
                    filters.valueRange[0],
                    parseFloat(e.target.value)
                  ])}
                  min={dataRange.minValue}
                  max={dataRange.maxValue}
                  step="0.01"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categories
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
                {availableCategories.map((category) => (
                  <label key={category} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(category)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('categories', [...filters.categories, category])
                        } else {
                          updateFilter('categories', filters.categories.filter(c => c !== category))
                        }
                      }}
                      className="mr-2 rounded"
                    />
                    {category}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sort Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <div className="flex space-x-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="name">Name</option>
                  <option value="value">Value</option>
                  <option value="timestamp">Time</option>
                </select>
                <button
                  onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                  className={`p-2 border border-gray-300 rounded-md transition-colors ${
                    filters.sortOrder === 'desc' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700'
                  }`}
                  title={`Sort ${filters.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                >
                  <TrendingUp className={`h-4 w-4 ${filters.sortOrder === 'desc' ? 'transform rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Aggregation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aggregation
              </label>
              <select
                value={filters.aggregation}
                onChange={(e) => updateFilter('aggregation', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Options
              </label>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={filters.showOutliers}
                  onChange={(e) => updateFilter('showOutliers', e.target.checked)}
                  className="mr-2 rounded"
                />
                Show Outliers
              </label>
            </div>
          </div>

          {/* Quick Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Filters
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateFilter('dateRange', {
                  start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                  end: new Date()
                })}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
              >
                Last 24h
              </button>
              <button
                onClick={() => updateFilter('dateRange', {
                  start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                  end: new Date()
                })}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
              >
                Last 7 days
              </button>
              <button
                onClick={() => updateFilter('dateRange', {
                  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                  end: new Date()
                })}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
              >
                Last 30 days
              </button>
              <button
                onClick={() => {
                  if (dataRange.minValue !== undefined && dataRange.maxValue !== undefined) {
                    const minVal = dataRange.minValue
                    const maxVal = dataRange.maxValue
                    const q1 = minVal + (maxVal - minVal) * 0.25
                    const q3 = minVal + (maxVal - minVal) * 0.75
                    updateFilter('valueRange', [q1, q3])
                  }
                }}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
              >
                Middle 50%
              </button>
              <button
                onClick={() => updateFilter('valueRange', [
                  dataRange.maxValue * 0.9,
                  dataRange.maxValue
                ])}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
              >
                Top 10%
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChartFilters