'use client'

import React, { useState } from 'react'
import { ProjectWithFinancials, Currency, ProjectStatus } from '@/types/costbook'
import { formatCurrency, getVarianceColorClass, formatPercentage } from '@/lib/currency-utils'
import { AnomalyResult } from '@/lib/costbook/anomaly-detection'
import { ProjectAnomalyStatus } from './AnomalyIndicator'
import { 
  ChevronDown, 
  ChevronUp,
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  Calendar,
  User,
  Minus,
  Target,
  Activity
} from 'lucide-react'
import {
  calculatePredictiveMetrics,
  PredictiveMetrics,
  getRiskLevelColor,
  getTrendIndicator,
  formatConfidence
} from '@/lib/predictive-calculations'
import {
  enrichProjectWithEVM,
  getIndexColorClass,
  getEVMStatusConfig,
  formatIndex,
  formatEVMCurrency
} from '@/lib/evm-calculations'
import { EVMProject, EVM_STATUS_CONFIG } from '@/types/evm'
import { CommentIndicator } from './CommentIndicator'
import { RundownSparklineWithLabel } from './RundownSparkline'
import { RundownProfile } from '@/types/rundown'

export interface ProjectCardProps {
  /** Project with financial data */
  project: ProjectWithFinancials
  /** Currency for display */
  currency: Currency
  /** Click handler for project selection */
  onClick?: (project: ProjectWithFinancials) => void
  /** Whether the card is currently selected */
  selected?: boolean
  /** Whether to show expanded details */
  expanded?: boolean
  /** Anomalies for this project */
  anomalies?: AnomalyResult[]
  /** Handler for anomaly clicks */
  onAnomalyClick?: (anomaly: AnomalyResult) => void
  /** Number of comments for this project */
  commentCount?: number
  /** Whether there are important comments */
  hasImportantComments?: boolean
  /** Handler for comment indicator click */
  onCommentsClick?: () => void
  /** Rundown profiles for sparkline display */
  rundownProfiles?: RundownProfile[]
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * Status indicator component
 */
function StatusDot({ status }: { status: ProjectStatus | string }) {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    [ProjectStatus.ACTIVE]: { 
      color: 'bg-green-500', 
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: 'Active'
    },
    [ProjectStatus.ON_HOLD]: { 
      color: 'bg-yellow-500', 
      icon: <Clock className="w-3 h-3" />,
      label: 'On Hold'
    },
    [ProjectStatus.COMPLETED]: { 
      color: 'bg-blue-500', 
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: 'Completed'
    },
    [ProjectStatus.CANCELLED]: { 
      color: 'bg-gray-400', 
      icon: <Ban className="w-3 h-3" />,
      label: 'Cancelled'
    },
    'at_risk': { 
      color: 'bg-red-500', 
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'At Risk'
    }
  }

  const config = statusConfig[status] || statusConfig[ProjectStatus.ACTIVE]

  return (
    <div className="flex items-center gap-1.5" title={config.label}>
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-gray-500 dark:text-slate-400">{config.label}</span>
    </div>
  )
}

/**
 * Progress bar component
 */
function ProgressBar({ 
  percentage, 
  showLabel = true 
}: { 
  percentage: number
  showLabel?: boolean 
}) {
  // Clamp percentage between 0 and 150 for display
  const displayPercentage = Math.min(Math.max(percentage, 0), 150)
  const widthPercentage = Math.min(displayPercentage, 100)
  
  // Color based on percentage
  let barColor = 'bg-green-500'
  if (percentage > 100) {
    barColor = 'bg-red-500'
  } else if (percentage > 80) {
    barColor = 'bg-yellow-500'
  }

  return (
    <div className="w-full">
      <div className="relative h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
        <div 
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${widthPercentage}%` }}
        />
        {percentage > 100 && (
          <div className="absolute inset-0 flex items-center justify-end pr-1">
            <AlertCircle className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-slate-400">
          <span>0%</span>
          <span className={percentage > 100 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
            {percentage.toFixed(1)}%
          </span>
          <span>100%</span>
        </div>
      )}
    </div>
  )
}

/**
 * Health score indicator
 */
function HealthIndicator({ score }: { score: number }) {
  let color = 'text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/50'
  let label = 'Healthy'
  
  if (score < 50) {
    color = 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/50'
    label = 'Critical'
  } else if (score < 75) {
    color = 'text-yellow-600 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/50'
    label = 'At Risk'
  }

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${color}`}>
      {label} ({score})
    </span>
  )
}

/**
 * Predictive metrics display component
 */
function PredictiveMetricsDisplay({
  metrics,
  currency
}: {
  metrics: PredictiveMetrics
  currency: Currency
}) {
  const riskColors = getRiskLevelColor(metrics.riskLevel)
  const trendInfo = getTrendIndicator(metrics.trend)
  const confidenceInfo = formatConfidence(metrics.confidence)
  
  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-purple-500 dark:text-purple-400" />
        <span className="text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wide">
          AI Predictions
        </span>
        <span className={`ml-auto px-2 py-0.5 text-xs font-medium rounded-full ${riskColors.bg} ${riskColors.text}`}>
          {metrics.riskLevel} risk
        </span>
      </div>
      
      <div className="space-y-2 text-sm">
        {/* Predicted EAC */}
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-slate-400 flex items-center gap-1">
            <Target className="w-3 h-3" />
            Predicted EAC
          </span>
          <div className="text-right">
            <span className="font-medium text-gray-900 dark:text-slate-100">
              {formatCurrency(metrics.predictedEAC, currency, { compact: true })}
            </span>
            <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">
              ({formatCurrency(metrics.eacLow, currency, { compact: true })} - {formatCurrency(metrics.eacHigh, currency, { compact: true })})
            </span>
          </div>
        </div>
        
        {/* ETC */}
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-slate-400">Est. to Complete</span>
          <span className="font-medium text-gray-900 dark:text-slate-100">
            {formatCurrency(metrics.etc, currency, { compact: true })}
          </span>
        </div>
        
        {/* Projected Variance */}
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-slate-400">Projected Variance</span>
          <span className={`font-medium ${metrics.projectedVariance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {metrics.projectedVariance >= 0 ? '+' : ''}{formatCurrency(metrics.projectedVariance, currency, { compact: true })}
          </span>
        </div>
        
        {/* Trend and Confidence */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-slate-600">
          <div className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-slate-400">Trend:</span>
            <span className={`flex items-center gap-0.5 font-medium ${trendInfo.color}`}>
              {trendInfo.icon === 'up' && <TrendingUp className="w-3 h-3" />}
              {trendInfo.icon === 'down' && <TrendingDown className="w-3 h-3" />}
              {trendInfo.icon === 'stable' && <Minus className="w-3 h-3" />}
              {trendInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-slate-400">Confidence:</span>
            <span className={`font-medium ${confidenceInfo.color}`}>
              {confidenceInfo.percentage}
            </span>
          </div>
        </div>
        
        {/* Budget exhaustion warning */}
        {metrics.daysUntilBudgetExhaustion !== undefined && (
          <div className={`flex items-center gap-2 p-2 rounded-lg ${riskColors.bg} mt-2`}>
            <AlertCircle className={`w-4 h-4 ${riskColors.text}`} />
            <span className={`text-xs ${riskColors.text}`}>
              {metrics.daysUntilBudgetExhaustion === 0 
                ? 'Budget already exhausted'
                : `Budget may be exhausted in ${metrics.daysUntilBudgetExhaustion} days`
              }
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * EVM metrics display component
 */
function EVMMetricsDisplay({
  project,
  currency
}: {
  project: ProjectWithFinancials
  currency: Currency
}) {
  // Calculate EVM metrics
  const evmProject = React.useMemo(() => {
    return enrichProjectWithEVM(project)
  }, [project])
  
  const { evmMetrics, evmStatus } = evmProject
  const statusConfig = getEVMStatusConfig(evmStatus)
  
  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-blue-500 dark:text-blue-400" />
        <span className="text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wide">
          Earned Value (EVM)
        </span>
        <span className={`ml-auto px-2 py-0.5 text-xs font-medium rounded-full border ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}>
          {statusConfig.label}
        </span>
      </div>
      
      <div className="space-y-2 text-sm">
        {/* CPI and SPI */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-500 dark:text-slate-400 text-xs mb-1">Cost Performance (CPI)</div>
            <div className={`font-semibold ${getIndexColorClass(evmMetrics.cpi)}`}>
              {formatIndex(evmMetrics.cpi)}
              <span className="text-xs font-normal text-gray-400 dark:text-slate-500 ml-1">
                {evmMetrics.cpi >= 1 ? 'Under budget' : 'Over budget'}
              </span>
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-slate-400 text-xs mb-1">Schedule Performance (SPI)</div>
            <div className={`font-semibold ${getIndexColorClass(evmMetrics.spi)}`}>
              {formatIndex(evmMetrics.spi)}
              <span className="text-xs font-normal text-gray-400 dark:text-slate-500 ml-1">
                {evmMetrics.spi >= 1 ? 'On track' : 'Behind'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Variances */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-slate-600">
          <div>
            <div className="text-gray-500 dark:text-slate-400 text-xs mb-1">Cost Variance</div>
            <div className={`font-medium ${evmMetrics.cv >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {evmMetrics.cv >= 0 ? '+' : ''}{formatEVMCurrency(evmMetrics.cv)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-slate-400 text-xs mb-1">Schedule Variance</div>
            <div className={`font-medium ${evmMetrics.sv >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {evmMetrics.sv >= 0 ? '+' : ''}{formatEVMCurrency(evmMetrics.sv)}
            </div>
          </div>
        </div>
        
        {/* TCPI Warning */}
        {evmMetrics.tcpi > 1.1 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 mt-2">
            <AlertCircle className="w-4 h-4 text-orange-500 dark:text-orange-400" />
            <span className="text-xs text-orange-700 dark:text-orange-300">
              TCPI {formatIndex(evmMetrics.tcpi)} - requires improved performance to meet budget
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * ProjectCard component for Costbook
 * Displays project summary with financial metrics and status
 */
export function ProjectCard({
  project,
  currency,
  onClick,
  selected = false,
  expanded: initialExpanded = false,
  anomalies = [],
  onAnomalyClick,
  commentCount = 0,
  hasImportantComments = false,
  onCommentsClick,
  rundownProfiles = [],
  className = '',
  'data-testid': testId = 'project-card'
}: ProjectCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded)

  const varianceColor = getVarianceColorClass(project.variance)
  const isOverBudget = project.variance < 0
  
  // Calculate predictive metrics
  const predictiveMetrics = React.useMemo(() => {
    return calculatePredictiveMetrics(project)
  }, [project])

  const handleClick = () => {
    if (onClick) {
      onClick(project)
    }
  }

  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  return (
    <div
      className={`
        bg-white dark:bg-slate-800
        rounded-lg
        shadow-md
        p-6
        border-2
        min-h-[320px]
        min-w-[280px]
        w-full
        ${selected ? 'border-blue-500 shadow-lg' : 'border-transparent dark:border-slate-700'}
        hover:shadow-lg
        transition-all
        duration-200
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={handleClick}
      data-testid={testId}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : undefined}
      aria-selected={selected}
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate" title={project.name}>
            {project.name}
          </h3>
          {anomalies.length > 0 && (
            <ProjectAnomalyStatus
              anomalies={anomalies}
              onAnomalyClick={onAnomalyClick}
              className="mt-1"
            />
          )}
        </div>
        <HealthIndicator score={project.health_score} />
        </div>
        <div className="flex items-center justify-between">
          <StatusDot status={project.status} />
          <CommentIndicator
            count={commentCount}
            hasImportant={hasImportantComments}
            onClick={onCommentsClick}
            size="sm"
          />
        </div>
      </div>

      {/* Financial Summary */}
      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Budget</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              {formatCurrency(project.budget, currency, { compact: true })}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Total Spend</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              {formatCurrency(project.total_spend, currency, { compact: true })}
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Variance</div>
          <div className={`text-sm font-semibold flex items-center justify-center gap-1 ${varianceColor}`}>
            {isOverBudget ? (
              <TrendingDown className="w-4 h-4" />
            ) : project.variance > 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : null}
            {formatCurrency(Math.abs(project.variance), currency, { compact: true })}
            {isOverBudget && ' over'}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="text-center mb-2">
          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            Progress ({project.spend_percentage.toFixed(1)}%)
          </div>
        </div>
        <ProgressBar percentage={project.spend_percentage} />
      </div>

      {/* Rundown Sparkline */}
      {rundownProfiles.length > 0 && (
        <div className="mb-4 px-1">
          <RundownSparklineWithLabel
            profiles={rundownProfiles}
            height={50}
            showVariance={true}
          />
        </div>
      )}

      {/* Expand/Collapse Button */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all rounded-md border border-transparent hover:border-gray-200 dark:hover:border-slate-600"
        aria-expanded={expanded}
      >
        {expanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            <span>Show less</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            <span>Show more</span>
          </>
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600 space-y-2 animate-in fade-in duration-200">
          {/* Cost Book columns (when present from costbook API) */}
          {(project.approved_budget != null || project.open_committed != null || project.eac != null) && (
            <div className="mb-3 p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600">
              <div className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-2 uppercase tracking-wide">Cost Book</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {project.pending_budget != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">Pending Budget</span>
                    <span className="font-medium tabular-nums">{formatCurrency(project.pending_budget, currency, { compact: true })}</span>
                  </div>
                )}
                {project.approved_budget != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">Approved Budget</span>
                    <span className="font-medium tabular-nums">{formatCurrency(project.approved_budget, currency, { compact: true })}</span>
                  </div>
                )}
                {project.control_estimate != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">Control Est.</span>
                    <span className="font-medium tabular-nums">{formatCurrency(project.control_estimate, currency, { compact: true })}</span>
                  </div>
                )}
                {project.open_committed != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">Open Committed</span>
                    <span className="font-medium tabular-nums">{formatCurrency(project.open_committed, currency, { compact: true })}</span>
                  </div>
                )}
                {project.invoice_value != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">Invoice Value</span>
                    <span className="font-medium tabular-nums">{formatCurrency(project.invoice_value, currency, { compact: true })}</span>
                  </div>
                )}
                {project.remaining_commitment != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">Rem. Commitment</span>
                    <span className="font-medium tabular-nums">{formatCurrency(project.remaining_commitment, currency, { compact: true })}</span>
                  </div>
                )}
                {project.vowd != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">VOWD</span>
                    <span className="font-medium tabular-nums">{formatCurrency(project.vowd, currency, { compact: true })}</span>
                  </div>
                )}
                {project.accruals != null && project.accruals !== 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">Accruals</span>
                    <span className="font-medium tabular-nums">{formatCurrency(project.accruals, currency, { compact: true })}</span>
                  </div>
                )}
                {project.etc != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">ETC</span>
                    <span className="font-medium tabular-nums">{formatCurrency(project.etc, currency, { compact: true })}</span>
                  </div>
                )}
                {project.eac != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">EAC</span>
                    <span className="font-medium tabular-nums">{formatCurrency(project.eac, currency, { compact: true })}</span>
                  </div>
                )}
                {project.delta_eac != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">Delta EAC</span>
                    <span className={`font-medium tabular-nums ${project.delta_eac >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(project.delta_eac, currency, { compact: true })}
                    </span>
                  </div>
                )}
                {project.variance != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 truncate">Variance</span>
                    <span className={`font-medium tabular-nums ${project.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(project.variance, currency, { compact: true })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500 dark:text-slate-400">Commitments</span>
              <p className="font-medium text-orange-600 dark:text-orange-400">
                {formatCurrency(project.total_commitments, currency)}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-slate-400">Actuals</span>
              <p className="font-medium text-purple-600 dark:text-purple-400">
                {formatCurrency(project.total_actuals, currency)}
              </p>
            </div>
          </div>

          {project.project_manager && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <User className="w-4 h-4" />
              <span>{project.project_manager}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(project.start_date).toLocaleDateString()} - {new Date(project.end_date).toLocaleDateString()}
            </span>
          </div>

          {project.description && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
              {project.description}
            </p>
          )}
          
          {/* EVM Metrics */}
          <EVMMetricsDisplay 
            project={project} 
            currency={currency} 
          />
          
          {/* Predictive Metrics */}
          <PredictiveMetricsDisplay 
            metrics={predictiveMetrics} 
            currency={currency} 
          />
        </div>
      )}
    </div>
  )
}

/**
 * Compact project row for list view
 */
export function ProjectRow({
  project,
  currency,
  onClick,
  anomalies = [],
  onAnomalyClick,
  showEacColumn = false
}: {
  project: ProjectWithFinancials
  currency: Currency
  onClick?: (project: ProjectWithFinancials) => void
  anomalies?: AnomalyResult[]
  onAnomalyClick?: (anomaly: AnomalyResult) => void
  showEacColumn?: boolean
}) {
  const varianceColor = getVarianceColorClass(project.variance)

  return (
    <div 
      className={`
        flex items-center justify-between 
        p-3 
        hover:bg-gray-50 dark:hover:bg-slate-700
        border-b border-gray-100 dark:border-slate-700
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={() => onClick?.(project)}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <StatusDot status={project.status} />
        <span className="font-medium text-gray-900 dark:text-slate-100 truncate">{project.name}</span>
      </div>
      
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500 dark:text-slate-400 w-24 text-right">
          {formatCurrency(project.budget, currency)}
        </span>
        <span className="text-gray-500 dark:text-slate-400 w-24 text-right">
          {formatCurrency(project.total_spend, currency)}
        </span>
        {showEacColumn && (
          <span className="text-gray-600 dark:text-slate-300 w-24 text-right font-medium">
            {project.eac != null ? formatCurrency(project.eac, currency) : '–'}
          </span>
        )}
        <span className={`${varianceColor} w-24 text-right font-medium`}>
          {formatCurrency(project.variance, currency)}
        </span>
        <span className="text-gray-500 dark:text-slate-400 w-16 text-right">
          {formatPercentage(project.spend_percentage, 0)}
        </span>
      </div>
    </div>
  )
}

export default ProjectCard