'use client'

import React, { useState, useMemo } from 'react'
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  Target,
  ChevronDown,
  ChevronUp,
  Eye,
  Check,
  X,
  Clock3,
  Sparkles
} from 'lucide-react'
import {
  EnhancedRecommendation,
  getRecommendationsSummary
} from '@/lib/recommendation-engine'

export interface RecommendationsPanelProps {
  /** List of recommendations to display */
  recommendations: EnhancedRecommendation[]
  /** Called when a recommendation is viewed */
  onView?: (recommendation: EnhancedRecommendation) => void
  /** Called when a recommendation is accepted */
  onAccept?: (recommendation: EnhancedRecommendation) => void
  /** Called when a recommendation is rejected */
  onReject?: (recommendation: EnhancedRecommendation) => void
  /** Called when a recommendation is deferred */
  onDefer?: (recommendation: EnhancedRecommendation) => void
  /** Whether the panel is collapsible */
  collapsible?: boolean
  /** Initial collapsed state */
  defaultCollapsed?: boolean
  /** Maximum recommendations to show initially */
  initialLimit?: number
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  'data-testid'?: string
}

/**
 * Get icon for recommendation category
 */
function getCategoryIcon(category: EnhancedRecommendation['category']) {
  switch (category) {
    case 'budget':
      return <TrendingUp className="w-4 h-4" />
    case 'vendor':
      return <Users className="w-4 h-4" />
    case 'timeline':
      return <Clock className="w-4 h-4" />
    case 'risk':
      return <AlertTriangle className="w-4 h-4" />
    case 'optimization':
      return <Target className="w-4 h-4" />
    default:
      return <Lightbulb className="w-4 h-4" />
  }
}

/**
 * Get color classes for priority level
 * Classes are combined to ensure Tailwind JIT can detect them at build time
 */
function getPriorityColors(priority: number): { bg: string; text: string; border: string } {
  if (priority >= 80) {
    return { 
      bg: 'bg-red-50 dark:bg-red-900/30', 
      text: 'text-red-700 dark:text-red-300', 
      border: 'border-red-200 dark:border-red-800' 
    }
  }
  if (priority >= 60) {
    return { 
      bg: 'bg-orange-50 dark:bg-orange-900/30', 
      text: 'text-orange-700 dark:text-orange-300', 
      border: 'border-orange-200 dark:border-orange-800' 
    }
  }
  if (priority >= 40) {
    return { 
      bg: 'bg-yellow-50 dark:bg-yellow-900/30', 
      text: 'text-yellow-700 dark:text-yellow-300', 
      border: 'border-yellow-200 dark:border-yellow-800' 
    }
  }
  return { 
    bg: 'bg-blue-50 dark:bg-blue-900/30', 
    text: 'text-blue-700 dark:text-blue-300', 
    border: 'border-blue-200 dark:border-blue-800' 
  }
}

/**
 * Get label for priority level
 */
function getPriorityLabel(priority: number): string {
  if (priority >= 80) return 'Critical'
  if (priority >= 60) return 'High'
  if (priority >= 40) return 'Medium'
  return 'Low'
}

/**
 * Format currency amount
 */
function formatImpact(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`
  }
  return `$${amount.toFixed(0)}`
}

/**
 * Individual recommendation card component
 */
interface RecommendationCardProps {
  recommendation: EnhancedRecommendation
  onView?: () => void
  onAccept?: () => void
  onReject?: () => void
  onDefer?: () => void
}

function RecommendationCard({
  recommendation,
  onView,
  onAccept,
  onReject,
  onDefer
}: RecommendationCardProps) {
  const colors = getPriorityColors(recommendation.priority)
  const isActionable = recommendation.status === 'pending'
  
  return (
    <div
      className={`
        p-4 rounded-lg border transition-all
        ${colors.bg} ${colors.border}
        ${isActionable ? 'hover:shadow-md' : 'opacity-75'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={colors.text}>
            {getCategoryIcon(recommendation.category)}
          </span>
          <span className={`text-xs font-medium uppercase tracking-wide ${colors.text}`}>
            {recommendation.category}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`
            px-2 py-0.5 text-xs font-medium rounded-full
            ${colors.bg} ${colors.text} border ${colors.border}
          `}>
            {getPriorityLabel(recommendation.priority)}
          </span>
          {recommendation.action_required && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
              Action Required
            </span>
          )}
        </div>
      </div>
      
      {/* Title and Description */}
      <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-1">
        {recommendation.title}
      </h4>
      <p className="text-sm text-gray-600 dark:text-slate-300 mb-3 line-clamp-2">
        {recommendation.description}
      </p>
      
      {/* Impact */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        <div>
          <span className="text-gray-500 dark:text-slate-400">Impact:</span>
          <span className={`ml-1 font-medium ${colors.text}`}>
            {formatImpact(recommendation.impact_amount)}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-slate-400">Confidence:</span>
          <span className="ml-1 font-medium text-gray-700 dark:text-slate-200">
            {(recommendation.confidence_score * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      
      {/* Status badge for non-pending items */}
      {recommendation.status !== 'pending' && (
        <div className="mb-3">
          <span className={`
            inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full
            ${recommendation.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : ''}
            ${recommendation.status === 'rejected' ? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300' : ''}
            ${recommendation.status === 'deferred' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : ''}
            ${recommendation.status === 'acknowledged' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : ''}
          `}>
            {recommendation.status === 'accepted' && <Check className="w-3 h-3" />}
            {recommendation.status === 'rejected' && <X className="w-3 h-3" />}
            {recommendation.status === 'deferred' && <Clock3 className="w-3 h-3" />}
            {recommendation.status.charAt(0).toUpperCase() + recommendation.status.slice(1)}
          </span>
        </div>
      )}
      
      {/* Actions */}
      {isActionable && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-200/50 dark:border-slate-600/50">
          <button
            onClick={onView}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-700/50 rounded transition-colors"
          >
            <Eye className="w-3 h-3" />
            Details
          </button>
          <button
            onClick={onAccept}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:bg-green-900/30/50 dark:hover:bg-green-900/30 rounded transition-colors"
          >
            <Check className="w-3 h-3" />
            Accept
          </button>
          <button
            onClick={onDefer}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-800 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:bg-blue-900/30/50 dark:hover:bg-blue-900/30 rounded transition-colors"
          >
            <Clock3 className="w-3 h-3" />
            Defer
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:bg-slate-700/50 dark:hover:bg-slate-700/50 rounded transition-colors"
          >
            <X className="w-3 h-3" />
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Recommendations Panel component
 */
export function RecommendationsPanel({
  recommendations,
  onView,
  onAccept,
  onReject,
  onDefer,
  collapsible = true,
  defaultCollapsed = false,
  initialLimit = 3,
  className = '',
  'data-testid': testId = 'recommendations-panel'
}: RecommendationsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [showAll, setShowAll] = useState(false)
  const [activeFilter, setActiveFilter] = useState<EnhancedRecommendation['category'] | 'all'>('all')
  
  const summary = useMemo(() => getRecommendationsSummary(recommendations), [recommendations])
  
  const filteredRecommendations = useMemo(() => {
    if (activeFilter === 'all') return recommendations
    return recommendations.filter(r => r.category === activeFilter)
  }, [recommendations, activeFilter])
  
  const displayedRecommendations = showAll 
    ? filteredRecommendations 
    : filteredRecommendations.slice(0, initialLimit)
  
  const pendingCount = recommendations.filter(r => r.status === 'pending').length
  
  if (recommendations.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 text-center ${className}`}
        data-testid={testId}
      >
        <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center bg-green-100 dark:bg-green-900/50 rounded-full">
          <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-1">No Recommendations</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Your portfolio is looking healthy! No action items at this time.
        </p>
      </div>
    )
  }
  
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <div
        className={`
          flex items-center justify-between p-4 
          ${collapsible ? 'cursor-pointer hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700' : ''} 
          border-b border-gray-200 dark:border-slate-700
        `}
        onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-slate-100">
              AI Recommendations
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">
                  {pendingCount} pending
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {summary.highPriority} high priority • {formatImpact(summary.totalImpact)} potential impact
            </p>
          </div>
        </div>
        {collapsible && (
          <button className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300">
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        )}
      </div>
      
      {/* Content */}
      {!isCollapsed && (
        <div className="p-4">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setActiveFilter('all')}
              className={`
                px-3 py-1 text-xs font-medium rounded-full transition-colors
                ${activeFilter === 'all' 
                  ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }
              `}
            >
              All ({recommendations.length})
            </button>
            {Object.entries(summary.byCategory).map(([category, count]) => (
              count > 0 && (
                <button
                  key={category}
                  onClick={() => setActiveFilter(category as EnhancedRecommendation['category'])}
                  className={`
                    flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors
                    ${activeFilter === category 
                      ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }
                  `}
                >
                  {getCategoryIcon(category as EnhancedRecommendation['category'])}
                  <span className="capitalize">{category}</span>
                  <span>({count})</span>
                </button>
              )
            ))}
          </div>
          
          {/* Recommendations list */}
          <div className="space-y-3">
            {displayedRecommendations.map(rec => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onView={() => onView?.(rec)}
                onAccept={() => onAccept?.(rec)}
                onReject={() => onReject?.(rec)}
                onDefer={() => onDefer?.(rec)}
              />
            ))}
          </div>
          
          {/* Show more/less */}
          {filteredRecommendations.length > initialLimit && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full mt-3 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {showAll 
                ? `Show less` 
                : `Show ${filteredRecommendations.length - initialLimit} more`
              }
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Compact recommendations badge for header/summary display
 */
export interface RecommendationsBadgeProps {
  /** Number of pending recommendations */
  count: number
  /** High priority count */
  highPriorityCount?: number
  /** Called when clicked */
  onClick?: () => void
  /** Additional CSS classes */
  className?: string
}

export function RecommendationsBadge({
  count,
  highPriorityCount = 0,
  onClick,
  className = ''
}: RecommendationsBadgeProps) {
  if (count === 0) return null
  
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5
        bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30
        text-purple-700 font-medium text-sm
        rounded-full transition-colors
        ${className}
      `}
    >
      <Sparkles className="w-4 h-4" />
      <span>{count} recommendations</span>
      {highPriorityCount > 0 && (
        <span className="px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 rounded-full">
          {highPriorityCount} urgent
        </span>
      )}
    </button>
  )
}

export default RecommendationsPanel
