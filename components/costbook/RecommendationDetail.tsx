'use client'

import React from 'react'
import {
  X,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Clock,
  Target,
  Check,
  Clock3,
  ArrowRight,
  ExternalLink,
  AlertCircle
} from 'lucide-react'
import { EnhancedRecommendation } from '@/lib/recommendation-engine'

export interface RecommendationDetailProps {
  /** The recommendation to display */
  recommendation: EnhancedRecommendation | null
  /** Whether the dialog is open */
  isOpen: boolean
  /** Called when the dialog should close */
  onClose: () => void
  /** Called when the recommendation is accepted */
  onAccept?: (recommendation: EnhancedRecommendation) => void
  /** Called when the recommendation is rejected */
  onReject?: (recommendation: EnhancedRecommendation) => void
  /** Called when the recommendation is deferred */
  onDefer?: (recommendation: EnhancedRecommendation) => void
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
      return <TrendingUp className="w-5 h-5" />
    case 'vendor':
      return <Users className="w-5 h-5" />
    case 'timeline':
      return <Clock className="w-5 h-5" />
    case 'risk':
      return <AlertTriangle className="w-5 h-5" />
    case 'optimization':
      return <Target className="w-5 h-5" />
    default:
      return <Lightbulb className="w-5 h-5" />
  }
}

/**
 * Get color classes for priority level
 */
function getPriorityColors(priority: number): { bg: string; text: string; border: string; light: string } {
  if (priority >= 80) {
    return { bg: 'bg-red-600', text: 'text-red-700', border: 'border-red-200 dark:border-red-800', light: 'bg-red-50 dark:bg-red-900/20' }
  }
  if (priority >= 60) {
    return { bg: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-200', light: 'bg-orange-50' }
  }
  if (priority >= 40) {
    return { bg: 'bg-yellow-500', text: 'text-yellow-700', border: 'border-yellow-200 dark:border-yellow-800', light: 'bg-yellow-50 dark:bg-yellow-900/20' }
  }
  return { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-200 dark:border-blue-800', light: 'bg-blue-50 dark:bg-blue-900/20' }
}

/**
 * Get label for priority level
 */
function getPriorityLabel(priority: number): string {
  if (priority >= 80) return 'Critical Priority'
  if (priority >= 60) return 'High Priority'
  if (priority >= 40) return 'Medium Priority'
  return 'Low Priority'
}

/**
 * Get trend icon
 */
function getTrendIcon(trend?: 'up' | 'down' | 'stable') {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-4 h-4 text-green-500 dark:text-green-400" />
    case 'down':
      return <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400" />
    case 'stable':
      return <Minus className="w-4 h-4 text-gray-400 dark:text-slate-500" />
    default:
      return null
  }
}

/**
 * Format value based on unit
 */
function formatValue(value: number, unit: string): string {
  if (unit === 'USD' || unit === '$') {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toFixed(0)}`
  }
  if (unit === '%') {
    return `${value.toFixed(1)}%`
  }
  if (unit === 'x') {
    return `${value.toFixed(1)}x`
  }
  if (unit === 'σ') {
    return `${value.toFixed(2)}σ`
  }
  if (unit === 'count') {
    return value.toString()
  }
  if (unit === 'days') {
    return `${value} days`
  }
  return `${value} ${unit}`
}

/**
 * Recommendation Detail Dialog component
 */
export function RecommendationDetail({
  recommendation,
  isOpen,
  onClose,
  onAccept,
  onReject,
  onDefer,
  className = '',
  'data-testid': testId = 'recommendation-detail'
}: RecommendationDetailProps) {
  if (!isOpen || !recommendation) return null
  
  const colors = getPriorityColors(recommendation.priority)
  const isActionable = recommendation.status === 'pending'
  
  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${className}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid={testId}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 ${colors.light} border-b ${colors.border}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-2 ${colors.bg} text-white rounded-lg`}>
                {getCategoryIcon(recommendation.category)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium uppercase tracking-wide ${colors.text}`}>
                    {recommendation.category}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors.light} ${colors.text}`}>
                    {getPriorityLabel(recommendation.priority)}
                  </span>
                  {recommendation.action_required && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700">
                      Action Required
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {recommendation.title}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-400 hover:bg-white dark:bg-slate-800/50 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">Description</h3>
            <p className="text-gray-700 dark:text-slate-300">{recommendation.description}</p>
          </div>
          
          {/* Impact and Confidence */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${colors.light} border ${colors.border}`}>
              <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">Potential Impact</div>
              <div className={`text-2xl font-bold ${colors.text}`}>
                {formatValue(recommendation.impact_amount, 'USD')}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
              <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">AI Confidence</div>
              <div className="text-2xl font-bold text-gray-700 dark:text-slate-300">
                {(recommendation.confidence_score * 100).toFixed(0)}%
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${recommendation.confidence_score * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Supporting Data */}
          {recommendation.supportingData.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">Supporting Metrics</h3>
              <div className="grid grid-cols-2 gap-3">
                {recommendation.supportingData.map((data, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg"
                  >
                    <span className="text-sm text-gray-600 dark:text-slate-400">{data.metric}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-slate-100">
                        {formatValue(data.value, data.unit)}
                      </span>
                      {getTrendIcon(data.trend)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Risks */}
          {recommendation.risks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                Potential Risks if Not Addressed
              </h3>
              <ul className="space-y-2">
                {recommendation.risks.map((risk, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300"
                  >
                    <ArrowRight className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Related Projects */}
          {recommendation.relatedProjects.length > 1 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">
                Related Projects ({recommendation.relatedProjects.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {recommendation.relatedProjects.map(projectId => (
                  <span
                    key={projectId}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-sm rounded-full"
                  >
                    {projectId}
                    <ExternalLink className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Status (for non-pending) */}
          {recommendation.status !== 'pending' && (
            <div className={`p-4 rounded-lg ${
              recommendation.status === 'accepted' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
              recommendation.status === 'rejected' ? 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700' :
              recommendation.status === 'deferred' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
              'bg-purple-50 border-purple-200'
            } border`}>
              <div className="flex items-center gap-2">
                {recommendation.status === 'accepted' && <Check className="w-5 h-5 text-green-600 dark:text-green-400" />}
                {recommendation.status === 'rejected' && <X className="w-5 h-5 text-gray-600 dark:text-slate-400" />}
                {recommendation.status === 'deferred' && <Clock3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  Status: {recommendation.status.charAt(0).toUpperCase() + recommendation.status.slice(1)}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer Actions */}
        {isActionable && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3">
            <button
              onClick={() => {
                onReject?.(recommendation)
                onClose()
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-lg transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={() => {
                onDefer?.(recommendation)
                onClose()
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-800 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 rounded-lg transition-colors"
            >
              <Clock3 className="w-4 h-4" />
              Defer
            </button>
            <button
              onClick={() => {
                onAccept?.(recommendation)
                onClose()
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white ${colors.bg} hover:opacity-90 rounded-lg transition-colors`}
            >
              <Check className="w-4 h-4" />
              Accept Recommendation
            </button>
          </div>
        )}
        
        {/* Close button for non-actionable */}
        {!isActionable && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-300 dark:border-slate-600 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecommendationDetail
