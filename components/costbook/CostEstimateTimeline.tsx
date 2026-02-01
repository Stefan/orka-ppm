'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
  Edit,
  Expand,
  Loader2,
  Calendar,
  DollarSign,
  User,
  ChevronDown,
  ChevronUp,
  Flag
} from 'lucide-react'
import {
  CostEstimateHistory,
  CostEstimateSnapshot,
  EstimateChangeType,
  fetchEstimateHistory,
  formatEstimateCurrency,
  formatChange,
  calculateEstimateSummary,
  ESTIMATE_CHANGE_CONFIG
} from '@/lib/cost-estimate-history'

export interface CostEstimateTimelineProps {
  /** Project ID to show timeline for */
  projectId: string
  /** Project name for display */
  projectName?: string
  /** Whether to show the chart */
  showChart?: boolean
  /** Whether to show compact view */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Get icon component for change type
 */
function getChangeIcon(type: EstimateChangeType) {
  const icons = {
    initial: FileText,
    scope_change: Expand,
    re_estimate: RefreshCw,
    contingency_adjustment: Shield,
    market_adjustment: TrendingUp,
    risk_adjustment: AlertTriangle,
    correction: Edit,
    approval: CheckCircle
  }
  return icons[type] || FileText
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Format date for chart axis
 */
function formatChartDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit'
  })
}

/**
 * Trend indicator component
 */
function TrendIndicator({ trend }: { trend: 'increasing' | 'stable' | 'decreasing' }) {
  const config = {
    increasing: { icon: TrendingUp, color: 'text-red-600', label: 'Increasing' },
    stable: { icon: Minus, color: 'text-gray-500', label: 'Stable' },
    decreasing: { icon: TrendingDown, color: 'text-green-600', label: 'Decreasing' }
  }
  
  const { icon: Icon, color, label } = config[trend]
  
  return (
    <span className={`flex items-center gap-1 text-sm ${color}`}>
      <Icon className="w-4 h-4" />
      {label}
    </span>
  )
}

/**
 * Timeline item component
 */
function TimelineItem({
  snapshot,
  isFirst,
  isLast,
  onSetBaseline
}: {
  snapshot: CostEstimateSnapshot
  isFirst: boolean
  isLast: boolean
  onSetBaseline?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const config = ESTIMATE_CHANGE_CONFIG[snapshot.change_type]
  const Icon = getChangeIcon(snapshot.change_type)
  
  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[17px] top-10 bottom-0 w-0.5 bg-gray-200" />
      )}
      
      {/* Icon */}
      <div className={`
        relative z-10 w-9 h-9 rounded-full flex items-center justify-center
        ${config.bgColor} ${config.color} border-2 border-white shadow
      `}>
        <Icon className="w-4 h-4" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${config.color}`}>
                {config.label}
              </span>
              {snapshot.is_baseline && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                  Baseline
                </span>
              )}
              {snapshot.approved_by && (
                <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded flex items-center gap-0.5">
                  <CheckCircle className="w-3 h-3" />
                  Approved
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDate(snapshot.estimate_date)}
            </p>
          </div>
          
          {/* Estimate value */}
          <div className="text-right">
            <div className="font-semibold text-gray-900">
              {formatEstimateCurrency(snapshot.estimate_value)}
            </div>
            {snapshot.change_amount !== 0 && (
              <div className={`text-sm ${
                snapshot.change_amount > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatChange(snapshot.change_amount)}
                <span className="text-xs ml-1">
                  ({snapshot.change_percentage > 0 ? '+' : ''}{snapshot.change_percentage}%)
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Description */}
        <p className="text-sm text-gray-600 mt-2">
          {snapshot.description}
        </p>
        
        {/* Expandable details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Hide' : 'Show'} details
        </button>
        
        {expanded && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs space-y-2">
            {snapshot.change_reason && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Reason:</span>
                <span className="capitalize">{snapshot.change_reason.replace('_', ' ')}</span>
              </div>
            )}
            {snapshot.confidence_level !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Confidence:</span>
                <span>{snapshot.confidence_level.toFixed(0)}%</span>
              </div>
            )}
            {snapshot.approved_by && (
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-gray-500">Approved by:</span>
                <span>{snapshot.approved_by}</span>
              </div>
            )}
            {snapshot.notes && (
              <div>
                <span className="text-gray-500">Notes:</span>
                <p className="mt-1 text-gray-600">{snapshot.notes}</p>
              </div>
            )}
            {!snapshot.is_baseline && onSetBaseline && (
              <button
                onClick={onSetBaseline}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 mt-2"
              >
                <Flag className="w-3 h-3" />
                Set as baseline
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Cost Estimate Timeline component
 */
export function CostEstimateTimeline({
  projectId,
  projectName,
  showChart = true,
  compact = false,
  className = ''
}: CostEstimateTimelineProps) {
  const [history, setHistory] = useState<CostEstimateHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllSnapshots, setShowAllSnapshots] = useState(false)
  
  // Load history
  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchEstimateHistory(projectId)
        setHistory(data)
      } catch (err) {
        setError('Failed to load estimate history')
        console.error('Error loading estimate history:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadHistory()
  }, [projectId])
  
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!history) return []
    return history.snapshots.map(s => ({
      date: formatChartDate(s.estimate_date),
      value: s.estimate_value,
      fullDate: s.estimate_date
    }))
  }, [history])
  
  // Get summary
  const summary = useMemo(() => {
    if (!history) return null
    return calculateEstimateSummary(history)
  }, [history])
  
  // Snapshots to display
  const displayedSnapshots = useMemo(() => {
    if (!history) return []
    const sorted = [...history.snapshots].sort(
      (a, b) => new Date(b.estimate_date).getTime() - new Date(a.estimate_date).getTime()
    )
    return showAllSnapshots || compact ? sorted : sorted.slice(0, 5)
  }, [history, showAllSnapshots, compact])
  
  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </div>
    )
  }
  
  if (error || !history) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-gray-400 py-8">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{error || 'No estimate history available'}</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-500" />
            <h3 className="font-medium text-gray-900">
              Cost Estimate Timeline
            </h3>
          </div>
          <TrendIndicator trend={history.trend} />
        </div>
        {projectName && (
          <p className="text-sm text-gray-500">{projectName}</p>
        )}
      </div>
      
      {/* Summary stats */}
      {summary && !compact && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 border-b border-gray-200">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">
              {formatEstimateCurrency(summary.current)}
            </div>
            <div className="text-xs text-gray-500">Current Estimate</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">
              {formatEstimateCurrency(summary.original)}
            </div>
            <div className="text-xs text-gray-500">Original Estimate</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${
              summary.variance_from_original > 0 ? 'text-red-600' : 
              summary.variance_from_original < 0 ? 'text-green-600' : 'text-gray-600'
            }`}>
              {formatChange(summary.variance_from_original)}
            </div>
            <div className="text-xs text-gray-500">Total Variance</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">
              {summary.number_of_revisions}
            </div>
            <div className="text-xs text-gray-500">Revisions</div>
          </div>
        </div>
      )}
      
      {/* Chart */}
      {showChart && !compact && chartData.length > 1 && (
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Estimate Evolution</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(value) => formatEstimateCurrency(value)}
                />
                <Tooltip 
                  formatter={(value: number) => [formatEstimateCurrency(value), 'Estimate']}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                {/* Baseline reference line */}
                {history.baseline_estimate > 0 && (
                  <ReferenceLine
                    y={history.baseline_estimate}
                    stroke="#3b82f6"
                    strokeDasharray="5 5"
                    label={{ 
                      value: 'Baseline', 
                      position: 'right', 
                      fill: '#3b82f6', 
                      fontSize: 11 
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      
      {/* Timeline */}
      <div className="p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Change History</h4>
        <div className="space-y-0">
          {displayedSnapshots.map((snapshot, index) => (
            <TimelineItem
              key={snapshot.id}
              snapshot={snapshot}
              isFirst={index === 0}
              isLast={index === displayedSnapshots.length - 1}
            />
          ))}
        </div>
        
        {/* Show more/less */}
        {history.snapshots.length > 5 && !compact && (
          <button
            onClick={() => setShowAllSnapshots(!showAllSnapshots)}
            className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            {showAllSnapshots ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show all {history.snapshots.length} changes
              </>
            )}
          </button>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Last updated: {formatDate(history.last_updated)}
        </span>
        <span>
          {history.total_change_percentage > 0 ? '+' : ''}{history.total_change_percentage}% from original
        </span>
      </div>
    </div>
  )
}

export default CostEstimateTimeline
