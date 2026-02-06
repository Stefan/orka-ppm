'use client'

import React, { useState, useCallback } from 'react'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
  Filter,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'

import type { AIInsight } from './types'

export interface MobileInsightsPanelProps {
  insights: AIInsight[]
  onValidateInsight: (insightId: string, isValid: boolean, notes?: string) => void
  onClose: () => void
  className?: string
}

const MobileInsightsPanel: React.FC<MobileInsightsPanelProps> = ({
  insights,
  onValidateInsight,
  onClose,
  className = ''
}) => {
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Filter insights
  const filteredInsights = insights.filter(insight => {
    if (filterCategory && insight.category !== filterCategory) return false
    if (filterPriority && insight.priority !== filterPriority) return false
    return true
  })

  // Group insights by category
  const insightsByCategory = filteredInsights.reduce((acc, insight) => {
    if (!acc[insight.category]) {
      acc[insight.category] = []
    }
    acc[insight.category].push(insight)
    return acc
  }, {} as Record<string, AIInsight[]>)

  const toggleInsight = useCallback((insightId: string) => {
    setExpandedInsight(prev => prev === insightId ? null : insightId)
  }, [])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 dark:text-red-400 bg-red-50 border-red-200 dark:border-red-800'
      case 'high':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 border-orange-200'
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 border-yellow-200 dark:border-yellow-800'
      case 'low':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 border-blue-200 dark:border-blue-800'
      default:
        return 'text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'budget':
        return <TrendingUp className="h-4 w-4" />
      case 'schedule':
        return <TrendingDown className="h-4 w-4" />
      case 'risk':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Sparkles className="h-4 w-4" />
    }
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">AI Insights</h2>
          <span className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 dark:bg-purple-900/30 rounded-full">
            {filteredInsights.length}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-md"
          >
            <Filter className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {['budget', 'schedule', 'resource', 'risk', 'quality'].map(category => (
                  <button
                    key={category}
                    onClick={() => setFilterCategory(filterCategory === category ? null : category)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      filterCategory === category
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">
                Priority
              </label>
              <div className="flex flex-wrap gap-2">
                {['critical', 'high', 'medium', 'low'].map(priority => (
                  <button
                    key={priority}
                    onClick={() => setFilterPriority(filterPriority === priority ? null : priority)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      filterPriority === priority
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600'
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insights List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(insightsByCategory).map(([category, categoryInsights]) => (
          <div key={category} className="border-b border-gray-200 dark:border-slate-700">
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center space-x-2">
                {getCategoryIcon(category)}
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 capitalize">
                  {category}
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-full">
                  {categoryInsights.length}
                </span>
              </div>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-slate-700">
              {categoryInsights.map(insight => (
                <div key={insight.id} className="bg-white dark:bg-slate-800">
                  <button
                    onClick={() => toggleInsight(insight.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(insight.priority)}`}>
                            {insight.priority}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-full">
                            {Math.round(insight.confidence_score * 100)}%
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">
                          {insight.title}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">
                          {insight.content}
                        </p>
                      </div>
                      <div className="ml-2 flex-shrink-0">
                        {expandedInsight === insight.id ? (
                          <ChevronUp className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {expandedInsight === insight.id && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-sm text-gray-700 dark:text-slate-300">{insight.content}</p>
                      </div>

                      {insight.predicted_impact && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <h5 className="text-xs font-semibold text-blue-900 mb-1">
                            Predicted Impact
                          </h5>
                          <p className="text-xs text-blue-700">{insight.predicted_impact}</p>
                        </div>
                      )}

                      {insight.recommended_actions && insight.recommended_actions.length > 0 && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <h5 className="text-xs font-semibold text-green-900 mb-2">
                            Recommended Actions
                          </h5>
                          <ul className="space-y-1">
                            {insight.recommended_actions.map((action, index) => (
                              <li key={index} className="flex items-start space-x-2 text-xs text-green-700">
                                <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Validation Actions */}
                      {!insight.validated && (
                        <div className="flex items-center space-x-2 pt-2">
                          <button
                            onClick={() => onValidateInsight(insight.id, true)}
                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-100 dark:bg-green-900/30 rounded-md hover:bg-green-200 transition-colors"
                          >
                            <ThumbsUp className="h-4 w-4" />
                            <span>Helpful</span>
                          </button>
                          <button
                            onClick={() => onValidateInsight(insight.id, false)}
                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 dark:bg-red-900/30 rounded-md hover:bg-red-200 transition-colors"
                          >
                            <ThumbsDown className="h-4 w-4" />
                            <span>Not Helpful</span>
                          </button>
                        </div>
                      )}

                      {insight.validated && (
                        <div className="flex items-center space-x-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-xs text-green-700">Validated</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredInsights.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
            <Sparkles className="h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">No insights found</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {filterCategory || filterPriority
                ? 'Try adjusting your filters'
                : 'AI insights will appear here as they are generated'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default MobileInsightsPanel
