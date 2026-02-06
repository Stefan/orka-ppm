'use client'

import React from 'react'
import { AlertTriangle, Zap, TrendingUp, Users, FileText } from 'lucide-react'
import { AnomalyResult, AnomalyType } from '@/lib/costbook/anomaly-detection'

export interface AnomalyIndicatorProps {
  /** Anomaly data */
  anomaly: AnomalyResult
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Show tooltip on hover */
  showTooltip?: boolean
  /** Custom class name */
  className?: string
  /** Click handler */
  onClick?: (anomaly: AnomalyResult) => void
  /** Test ID */
  'data-testid'?: string
}

/**
 * Get icon for anomaly type
 */
function getAnomalyIcon(type: AnomalyType, size: 'sm' | 'md' | 'lg' = 'md') {
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'

  const iconProps = {
    className: iconSize,
    'aria-hidden': true
  }

  switch (type) {
    case AnomalyType.VARIANCE_OUTLIER:
      return <TrendingUp {...iconProps} />
    case AnomalyType.SPEND_VELOCITY:
      return <Zap {...iconProps} />
    case AnomalyType.BUDGET_UTILIZATION_SPIKE:
      return <AlertTriangle {...iconProps} />
    case AnomalyType.VENDOR_CONCENTRATION:
      return <Users {...iconProps} />
    case AnomalyType.UNUSUAL_COMMITMENT_PATTERN:
      return <FileText {...iconProps} />
    default:
      return <AlertTriangle {...iconProps} />
  }
}

/**
 * Get color scheme for severity level
 */
function getSeverityColors(severity: 'low' | 'medium' | 'high' | 'critical') {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        border: 'border-red-300 dark:border-red-700',
        text: 'text-red-800 dark:text-red-300',
        icon: 'text-red-600 dark:text-red-400'
      }
    case 'high':
      return {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        border: 'border-orange-300',
        text: 'text-orange-800 dark:text-orange-300',
        icon: 'text-orange-600 dark:text-orange-400'
      }
    case 'medium':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        border: 'border-yellow-300',
        text: 'text-yellow-800 dark:text-yellow-300',
        icon: 'text-yellow-600 dark:text-yellow-400'
      }
    case 'low':
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        border: 'border-blue-300',
        text: 'text-blue-800 dark:text-blue-300',
        icon: 'text-blue-600 dark:text-blue-400'
      }
  }
}

/**
 * AnomalyIndicator component for highlighting projects with anomalies
 */
export function AnomalyIndicator({
  anomaly,
  size = 'md',
  showTooltip = true,
  className = '',
  onClick,
  'data-testid': testId = 'anomaly-indicator'
}: AnomalyIndicatorProps) {
  const colors = getSeverityColors(anomaly.severity)
  const icon = getAnomalyIcon(anomaly.anomalyType, size)

  const sizeClasses = {
    sm: 'p-1 text-xs',
    md: 'p-1.5 text-sm',
    lg: 'p-2 text-base'
  }

  const handleClick = () => {
    if (onClick) {
      onClick(anomaly)
    }
  }

  return (
    <div
      className={`
        inline-flex items-center gap-1
        ${sizeClasses[size]}
        ${colors.bg} ${colors.border}
        border rounded-full
        cursor-pointer
        transition-all hover:scale-105
        ${className}
      `}
      onClick={handleClick}
      role={onClick ? 'button' : 'status'}
      aria-label={`Anomaly detected: ${anomaly.description}`}
      data-testid={testId}
      title={showTooltip ? anomaly.description : undefined}
    >
      <span className={colors.icon}>
        {icon}
      </span>

      {size !== 'sm' && (
        <span className={`font-medium ${colors.text} uppercase tracking-wide`}>
          {anomaly.severity}
        </span>
      )}

      {/* Confidence indicator */}
      <div
        className="w-1 h-1 rounded-full bg-current opacity-60"
        title={`Confidence: ${(anomaly.confidence * 100).toFixed(0)}%`}
      />
    </div>
  )
}

/**
 * Compact anomaly badge for project cards
 */
export function AnomalyBadge({
  anomaly,
  className = ''
}: {
  anomaly: AnomalyResult
  className?: string
}) {
  const colors = getSeverityColors(anomaly.severity)

  return (
    <div
      className={`
        inline-flex items-center gap-1
        px-2 py-1
        text-xs font-medium
        ${colors.bg} ${colors.text}
        border ${colors.border}
        rounded-full
        ${className}
      `}
      title={anomaly.description}
    >
      {getAnomalyIcon(anomaly.anomalyType, 'sm')}
      <span className="capitalize">{anomaly.severity}</span>
    </div>
  )
}

/**
 * Anomaly summary badge
 */
export function AnomalySummaryBadge({
  count,
  severity,
  className = ''
}: {
  count: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  className?: string
}) {
  if (count === 0) return null

  const colors = getSeverityColors(severity)
  const icon = getAnomalyIcon(AnomalyType.VARIANCE_OUTLIER, 'sm')

  return (
    <div
      className={`
        inline-flex items-center gap-1
        px-2 py-1
        text-xs font-medium
        ${colors.bg} ${colors.text}
        border ${colors.border}
        rounded-full
        ${className}
      `}
      title={`${count} ${severity} severity anomal${count === 1 ? 'y' : 'ies'} detected`}
    >
      <span className={colors.icon}>
        {icon}
      </span>
      <span>{count}</span>
    </div>
  )
}

/**
 * Anomaly status indicator for project headers
 */
export function ProjectAnomalyStatus({
  anomalies,
  onAnomalyClick,
  className = ''
}: {
  anomalies: AnomalyResult[]
  onAnomalyClick?: (anomaly: AnomalyResult) => void
  className?: string
}) {
  if (anomalies.length === 0) return null

  const highestSeverity = anomalies.reduce((highest, current) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    return severityOrder[current.severity] > severityOrder[highest.severity] ? current : highest
  })

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <AnomalyIndicator
        anomaly={highestSeverity}
        size="sm"
        onClick={onAnomalyClick}
        data-testid="project-anomaly-status"
      />
      {anomalies.length > 1 && (
        <span className="text-xs text-gray-500 dark:text-slate-400">
          +{anomalies.length - 1} more
        </span>
      )}
    </div>
  )
}

export default AnomalyIndicator