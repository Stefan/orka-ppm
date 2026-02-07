'use client'

import React, { useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Activity,
  Clock,
  Database,
  Cpu,
  HardDrive,
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'

export interface PerformanceMetrics {
  /** Time to fetch data from API (ms) */
  queryTime?: number
  /** Time to render components (ms) */
  renderTime?: number
  /** Time for data transformations (ms) */
  transformTime?: number
  /** Total load time (ms) */
  totalTime?: number
  /** Number of projects loaded */
  projectCount?: number
  /** Number of commitments loaded */
  commitmentCount?: number
  /** Number of actuals loaded */
  actualCount?: number
  /** Total records processed */
  totalRecords?: number
  /** Cache hit rate (0-100) */
  cacheHitRate?: number
  /** Last refresh timestamp */
  lastRefresh?: string
  /** Memory usage (MB) */
  memoryUsage?: number
  /** API response size (KB) */
  responseSize?: number
  /** Error count */
  errorCount?: number
}

export interface PerformanceDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Handler to close the dialog */
  onClose: () => void
  /** Performance metrics to display */
  metrics: PerformanceMetrics
  /** Handler to refresh metrics */
  onRefresh?: () => void
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

// Performance thresholds
const THRESHOLDS = {
  queryTime: { good: 200, warning: 500 },
  renderTime: { good: 100, warning: 300 },
  totalTime: { good: 500, warning: 1000 },
  cacheHitRate: { good: 80, warning: 50 }
}

/**
 * Get status color based on value and thresholds
 */
function getStatusColor(
  value: number | undefined,
  thresholds: { good: number; warning: number },
  inverse: boolean = false
): 'green' | 'yellow' | 'red' | 'gray' {
  if (value === undefined) return 'gray'
  
  if (inverse) {
    // Higher is better (e.g., cache hit rate)
    if (value >= thresholds.good) return 'green'
    if (value >= thresholds.warning) return 'yellow'
    return 'red'
  } else {
    // Lower is better (e.g., query time)
    if (value <= thresholds.good) return 'green'
    if (value <= thresholds.warning) return 'yellow'
    return 'red'
  }
}

/**
 * Status indicator component
 */
function StatusIndicator({ status }: { status: 'green' | 'yellow' | 'red' | 'gray' }) {
  const colors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400'
  }
  
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />
  )
}

/**
 * Metric card component
 */
function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  status,
  subtext
}: {
  icon: React.ElementType
  label: string
  value: string | number | undefined
  unit?: string
  status?: 'green' | 'yellow' | 'red' | 'gray'
  subtext?: string
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
        </div>
        {status && <StatusIndicator status={status} />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {value !== undefined ? value : '-'}
        </span>
        {unit && value !== undefined && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>
        )}
      </div>
      {subtext && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtext}</p>
      )}
    </div>
  )
}

/**
 * PerformanceDialog component for displaying performance metrics
 * Shows query time, render time, data statistics, and cache performance
 */
export function PerformanceDialog({
  isOpen,
  onClose,
  metrics,
  onRefresh,
  className = '',
  'data-testid': testId = 'performance-dialog'
}: PerformanceDialogProps) {
  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    const totalRecords = metrics.totalRecords ?? 
      (metrics.projectCount ?? 0) + 
      (metrics.commitmentCount ?? 0) + 
      (metrics.actualCount ?? 0)
    
    const avgRecordTime = metrics.totalTime && totalRecords > 0
      ? (metrics.totalTime / totalRecords).toFixed(2)
      : undefined
    
    return {
      totalRecords,
      avgRecordTime
    }
  }, [metrics])

  // Overall health status
  const overallStatus = useMemo(() => {
    const statuses = [
      getStatusColor(metrics.queryTime, THRESHOLDS.queryTime),
      getStatusColor(metrics.renderTime, THRESHOLDS.renderTime),
      getStatusColor(metrics.totalTime, THRESHOLDS.totalTime),
      getStatusColor(metrics.cacheHitRate, THRESHOLDS.cacheHitRate, true)
    ].filter(s => s !== 'gray')
    
    if (statuses.includes('red')) return 'red'
    if (statuses.includes('yellow')) return 'yellow'
    if (statuses.length > 0) return 'green'
    return 'gray'
  }, [metrics])

  if (!isOpen) return null

  const dialogContent = (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby="performance-dialog-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className={`relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            <div>
              <h2 id="performance-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Performance Metrics
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusIndicator status={overallStatus} />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {overallStatus === 'green' && 'All systems healthy'}
                  {overallStatus === 'yellow' && 'Some metrics need attention'}
                  {overallStatus === 'red' && 'Performance issues detected'}
                  {overallStatus === 'gray' && 'No data available'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Refresh metrics"
              >
                <RefreshCw className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Timing metrics */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Response Times
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={Database}
                label="Query Time"
                value={metrics.queryTime}
                unit="ms"
                status={getStatusColor(metrics.queryTime, THRESHOLDS.queryTime)}
                subtext={metrics.queryTime !== undefined 
                  ? metrics.queryTime <= THRESHOLDS.queryTime.good ? 'Excellent' : 'Could be faster'
                  : undefined
                }
              />
              <MetricCard
                icon={Cpu}
                label="Render Time"
                value={metrics.renderTime}
                unit="ms"
                status={getStatusColor(metrics.renderTime, THRESHOLDS.renderTime)}
              />
              <MetricCard
                icon={Activity}
                label="Transform Time"
                value={metrics.transformTime}
                unit="ms"
              />
              <MetricCard
                icon={Gauge}
                label="Total Time"
                value={metrics.totalTime}
                unit="ms"
                status={getStatusColor(metrics.totalTime, THRESHOLDS.totalTime)}
              />
            </div>
          </div>

          {/* Data statistics */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Data Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={HardDrive}
                label="Projects"
                value={metrics.projectCount}
              />
              <MetricCard
                icon={HardDrive}
                label="Commitments"
                value={metrics.commitmentCount}
              />
              <MetricCard
                icon={HardDrive}
                label="Actuals"
                value={metrics.actualCount}
              />
              <MetricCard
                icon={HardDrive}
                label="Total Records"
                value={derivedMetrics.totalRecords}
                subtext={derivedMetrics.avgRecordTime 
                  ? `~${derivedMetrics.avgRecordTime}ms per record`
                  : undefined
                }
              />
            </div>
          </div>

          {/* Cache & system */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Cache & System
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={TrendingUp}
                label="Cache Hit Rate"
                value={metrics.cacheHitRate !== undefined ? `${metrics.cacheHitRate}` : undefined}
                unit="%"
                status={getStatusColor(metrics.cacheHitRate, THRESHOLDS.cacheHitRate, true)}
              />
              <MetricCard
                icon={HardDrive}
                label="Response Size"
                value={metrics.responseSize}
                unit="KB"
              />
              <MetricCard
                icon={Cpu}
                label="Memory Usage"
                value={metrics.memoryUsage}
                unit="MB"
              />
              <MetricCard
                icon={metrics.errorCount && metrics.errorCount > 0 ? AlertTriangle : CheckCircle}
                label="Errors"
                value={metrics.errorCount ?? 0}
                status={metrics.errorCount && metrics.errorCount > 0 ? 'red' : 'green'}
              />
            </div>
          </div>

          {/* Last refresh */}
          {metrics.lastRefresh && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
              <RefreshCw className="w-4 h-4" />
              <span>Last updated: {new Date(metrics.lastRefresh).toLocaleString()}</span>
            </div>
          )}

          {/* Tips */}
          {overallStatus === 'yellow' || overallStatus === 'red' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Performance Tips
                  </h4>
                  <ul className="mt-2 text-sm text-blue-700 dark:text-blue-400 list-disc list-inside space-y-1">
                    {metrics.queryTime && metrics.queryTime > THRESHOLDS.queryTime.warning && (
                      <li>Consider adding database indexes for frequently queried fields</li>
                    )}
                    {metrics.renderTime && metrics.renderTime > THRESHOLDS.renderTime.warning && (
                      <li>Use virtualization for large lists to improve render performance</li>
                    )}
                    {metrics.cacheHitRate !== undefined && metrics.cacheHitRate < THRESHOLDS.cacheHitRate.warning && (
                      <li>Increase cache TTL or prefetch commonly accessed data</li>
                    )}
                    {metrics.responseSize && metrics.responseSize > 500 && (
                      <li>Consider implementing pagination to reduce response sizes</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(dialogContent, document.body)
}

export default PerformanceDialog
