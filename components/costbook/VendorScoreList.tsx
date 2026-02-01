'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Ban,
  Loader2,
  RefreshCw,
  X
} from 'lucide-react'
import {
  VendorWithMetrics,
  VendorRating,
  VendorFilter,
  VendorSortOption,
  VendorCategory,
  VendorStatus,
  VENDOR_RATING_CONFIG,
  VENDOR_CATEGORY_CONFIG
} from '@/types/vendor'
import {
  fetchVendors,
  getVendorRatingConfig,
  getScoreBgColorClass,
  formatScore,
  formatPercentage
} from '@/lib/vendor-scoring'

export interface VendorScoreListProps {
  /** Handler for vendor selection */
  onVendorSelect?: (vendor: VendorWithMetrics) => void
  /** Currently selected vendor ID */
  selectedVendorId?: string
  /** Maximum number of vendors to display */
  limit?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Rating badge component
 */
function RatingBadge({ rating }: { rating: VendorRating }) {
  const config = getVendorRatingConfig(rating)
  
  return (
    <span className={`
      inline-flex items-center justify-center
      w-8 h-8 rounded-full
      text-lg font-bold
      ${config.bgColor} ${config.color}
    `}>
      {rating}
    </span>
  )
}

/**
 * Score bar component
 */
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all ${
          score >= 90 ? 'bg-emerald-500' :
          score >= 75 ? 'bg-green-500' :
          score >= 60 ? 'bg-yellow-500' :
          score >= 40 ? 'bg-orange-500' :
          'bg-red-500'
        }`}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

/**
 * Status indicator
 */
function StatusIndicator({ status }: { status: VendorStatus }) {
  const config: Record<VendorStatus, { icon: React.ReactNode; color: string; label: string }> = {
    active: { icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-600', label: 'Active' },
    inactive: { icon: <Clock className="w-3 h-3" />, color: 'text-gray-400', label: 'Inactive' },
    pending: { icon: <Clock className="w-3 h-3" />, color: 'text-yellow-600', label: 'Pending' },
    suspended: { icon: <Ban className="w-3 h-3" />, color: 'text-red-600', label: 'Suspended' }
  }
  
  const statusConfig = config[status]
  
  return (
    <span className={`flex items-center gap-1 text-xs ${statusConfig.color}`}>
      {statusConfig.icon}
      {statusConfig.label}
    </span>
  )
}

/**
 * Vendor Score List component
 */
export function VendorScoreList({
  onVendorSelect,
  selectedVendorId,
  limit,
  className = ''
}: VendorScoreListProps) {
  const [vendors, setVendors] = useState<VendorWithMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filter, setFilter] = useState<VendorFilter>({})
  const [sort, setSort] = useState<VendorSortOption>({ field: 'overall_score', direction: 'desc' })
  
  // Load vendors
  const loadVendors = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchVendors(filter, sort)
      setVendors(limit ? data.slice(0, limit) : data)
    } catch (err) {
      setError('Failed to load vendors')
      console.error('Error loading vendors:', err)
    } finally {
      setLoading(false)
    }
  }, [filter, sort, limit])
  
  useEffect(() => {
    loadVendors()
  }, [loadVendors])
  
  // Filter by search
  const filteredVendors = useMemo(() => {
    if (!searchQuery) return vendors
    const query = searchQuery.toLowerCase()
    return vendors.filter(v => 
      v.name.toLowerCase().includes(query) ||
      v.category.toLowerCase().includes(query)
    )
  }, [vendors, searchQuery])
  
  // Toggle sort direction
  const toggleSort = (field: VendorSortOption['field']) => {
    if (sort.field === field) {
      setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      setSort({ field, direction: 'desc' })
    }
  }
  
  // Update filter
  const updateFilter = (key: keyof VendorFilter, value: any) => {
    setFilter(prev => ({ ...prev, [key]: value }))
  }
  
  // Clear filters
  const clearFilters = () => {
    setFilter({})
    setSearchQuery('')
  }
  
  const hasActiveFilters = Object.keys(filter).length > 0 || searchQuery.length > 0
  
  return (
    <div className={`bg-white rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            Vendor Performance
          </h3>
          <button
            onClick={loadVendors}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Search and filters */}
        <div className="space-y-3">
          <div className="flex gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                px-3 py-2 border rounded-lg text-sm flex items-center gap-1 transition-colors
                ${showFilters || hasActiveFilters
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              <Filter className="w-4 h-4" />
              <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {/* Filter panel */}
          {showFilters && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              {/* Rating filter */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Rating</label>
                <div className="flex gap-1">
                  {(['A', 'B', 'C', 'D', 'F'] as VendorRating[]).map(rating => (
                    <button
                      key={rating}
                      onClick={() => {
                        const current = filter.rating || []
                        if (current.includes(rating)) {
                          updateFilter('rating', current.filter(r => r !== rating))
                        } else {
                          updateFilter('rating', [...current, rating])
                        }
                      }}
                      className={`
                        w-8 h-8 rounded text-sm font-bold transition-colors
                        ${(filter.rating || []).includes(rating)
                          ? VENDOR_RATING_CONFIG[rating].bgColor + ' ' + VENDOR_RATING_CONFIG[rating].color
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }
                      `}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Status filter */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                <div className="flex gap-1 flex-wrap">
                  {(['active', 'inactive', 'pending', 'suspended'] as VendorStatus[]).map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        const current = filter.status || []
                        if (current.includes(status)) {
                          updateFilter('status', current.filter(s => s !== status))
                        } else {
                          updateFilter('status', [...current, status])
                        }
                      }}
                      className={`
                        px-2 py-1 rounded text-xs capitalize transition-colors
                        ${(filter.status || []).includes(status)
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }
                      `}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Sort controls */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-gray-500">Sort by:</span>
          {[
            { field: 'overall_score' as const, label: 'Score' },
            { field: 'name' as const, label: 'Name' },
            { field: 'on_time_delivery_rate' as const, label: 'On-Time' },
            { field: 'projects_completed' as const, label: 'Projects' }
          ].map(({ field, label }) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`
                flex items-center gap-0.5 px-2 py-1 rounded transition-colors
                ${sort.field === field
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              {label}
              {sort.field === field && (
                <ArrowUpDown className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Vendor list */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-600">{error}</div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No vendors found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredVendors.map(vendor => (
              <button
                key={vendor.id}
                onClick={() => onVendorSelect?.(vendor)}
                className={`
                  w-full p-4 text-left hover:bg-gray-50 transition-colors
                  ${selectedVendorId === vendor.id ? 'bg-blue-50' : ''}
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Rating badge */}
                  <RatingBadge rating={vendor.score.rating} />
                  
                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900 truncate">
                        {vendor.name}
                      </h4>
                      <span className={`text-lg font-bold ${
                        vendor.score.overall_score >= 75 ? 'text-green-600' : 
                        vendor.score.overall_score >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {formatScore(vendor.score.overall_score)}
                      </span>
                    </div>
                    
                    {/* Score bar */}
                    <div className="mb-2">
                      <ScoreBar score={vendor.score.overall_score} />
                    </div>
                    
                    {/* Metrics row */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {vendor.score.on_time_delivery_rate}% on-time
                      </span>
                      <span className={vendor.score.cost_variance_percentage > 5 ? 'text-red-600' : ''}>
                        {formatPercentage(vendor.score.cost_variance_percentage)} variance
                      </span>
                      <span>
                        {vendor.score.projects_completed} projects
                      </span>
                    </div>
                    
                    {/* Status and category */}
                    <div className="flex items-center gap-2 mt-2">
                      <StatusIndicator status={vendor.status} />
                      <span className="text-xs text-gray-400 capitalize">
                        {vendor.category}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer */}
      {!loading && filteredVendors.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          Showing {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default VendorScoreList
