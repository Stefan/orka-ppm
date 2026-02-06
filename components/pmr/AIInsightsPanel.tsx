'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useTranslations } from '../../lib/i18n/context'
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Target, 
  DollarSign, 
  Users, 
  Calendar,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Filter,
  RefreshCw,
  Lightbulb,
  Zap,
  BarChart3,
  Activity
} from 'lucide-react'

// Types for AI Insights
export interface AIInsight {
  id: string
  type: 'prediction' | 'recommendation' | 'alert' | 'summary'
  category: 'budget' | 'schedule' | 'resource' | 'risk' | 'quality'
  title: string
  content: string
  confidence_score: number
  supporting_data: Record<string, any>
  predicted_impact?: string
  recommended_actions: string[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  generated_at: string
  validated: boolean
  validation_notes?: string
  user_feedback?: 'helpful' | 'not_helpful' | null
}

export interface AIInsightsPanelProps {
  insights: AIInsight[]
  onInsightValidate: (insightId: string, isValid: boolean, notes?: string) => void
  onInsightApply: (insightId: string) => void
  onGenerateInsights: (categories?: string[]) => void
  onInsightFeedback: (insightId: string, feedback: 'helpful' | 'not_helpful') => void
  isLoading?: boolean
  className?: string
}

interface InsightFilters {
  categories: string[]
  types: string[]
  priorities: string[]
  validated: boolean | null
  minConfidence: number
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
  insights,
  onInsightValidate,
  onInsightApply,
  onGenerateInsights,
  onInsightFeedback,
  isLoading = false,
  className = ''
}) => {
  const { t } = useTranslations()
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<InsightFilters>({
    categories: [],
    types: [],
    priorities: [],
    validated: null,
    minConfidence: 0
  })

  // Filter insights based on current filters
  const filteredInsights = useMemo(() => {
    return insights.filter(insight => {
      if (filters.categories.length > 0 && !filters.categories.includes(insight.category)) {
        return false
      }
      if (filters.types.length > 0 && !filters.types.includes(insight.type)) {
        return false
      }
      if (filters.priorities.length > 0 && !filters.priorities.includes(insight.priority)) {
        return false
      }
      if (filters.validated !== null && insight.validated !== filters.validated) {
        return false
      }
      if (insight.confidence_score < filters.minConfidence / 100) {
        return false
      }
      return true
    })
  }, [insights, filters])

  // Group insights by category
  const insightsByCategory = useMemo(() => {
    const grouped: Record<string, AIInsight[]> = {}
    filteredInsights.forEach(insight => {
      if (!grouped[insight.category]) {
        grouped[insight.category] = []
      }
      grouped[insight.category]!.push(insight)
    })
    return grouped
  }, [filteredInsights])

  const toggleInsightExpansion = useCallback((insightId: string) => {
    setExpandedInsights(prev => {
      const newSet = new Set(prev)
      if (newSet.has(insightId)) {
        newSet.delete(insightId)
      } else {
        newSet.add(insightId)
      }
      return newSet
    })
  }, [])

  const handleValidateInsight = useCallback((insight: AIInsight, isValid: boolean) => {
    const notes = isValid ? t('pmr.insights.card.validated') : t('pmr.insights.card.markInvalid')
    onInsightValidate(insight.id, isValid, notes)
  }, [onInsightValidate, t])

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'prediction':
        return <TrendingUp className="h-4 w-4" />
      case 'recommendation':
        return <Lightbulb className="h-4 w-4" />
      case 'alert':
        return <AlertTriangle className="h-4 w-4" />
      case 'summary':
        return <BarChart3 className="h-4 w-4" />
      default:
        return <Brain className="h-4 w-4" />
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'budget':
        return <DollarSign className="h-4 w-4" />
      case 'schedule':
        return <Calendar className="h-4 w-4" />
      case 'resource':
        return <Users className="h-4 w-4" />
      case 'risk':
        return <AlertTriangle className="h-4 w-4" />
      case 'quality':
        return <Target className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
    return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
      case 'high':
        return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30'
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
      case 'low':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
      default:
        return 'text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700'
    }
  }

  const renderInsightCard = (insight: AIInsight) => {
    const isExpanded = expandedInsights.has(insight.id)
    
    return (
      <div key={insight.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
        {/* Insight Header */}
        <div 
          className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 transition-colors"
          onClick={() => toggleInsightExpansion(insight.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className="flex-shrink-0 mt-1">
                {getInsightIcon(insight.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {insight.title}
                  </h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(insight.priority)}`}>
                    {t(`pmr.insights.priorities.${insight.priority}`)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">
                  {insight.content}
                </p>
                <div className="flex items-center space-x-4 mt-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConfidenceColor(insight.confidence_score)}`}>
                    {t('pmr.insights.card.confidence', { percent: Math.round(insight.confidence_score * 100) })}
                  </span>
                  {insight.validated && (
                    <span className="flex items-center text-xs text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('pmr.insights.card.validated')}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {new Date(insight.generated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 ml-2">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-400 dark:text-slate-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400 dark:text-slate-500" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-slate-700 p-4 space-y-4">
            {/* Full Content */}
            <div>
              <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">{t('pmr.insights.card.details')}</h5>
              <p className="text-sm text-gray-700 dark:text-slate-300">{insight.content}</p>
            </div>

            {/* Predicted Impact */}
            {insight.predicted_impact && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">{t('pmr.insights.card.predictedImpact')}</h5>
                <p className="text-sm text-gray-700 dark:text-slate-300">{insight.predicted_impact}</p>
              </div>
            )}

            {/* Recommended Actions */}
            {insight.recommended_actions.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">{t('pmr.insights.card.recommendedActions')}</h5>
                <ul className="space-y-1">
                  {insight.recommended_actions.map((action, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm text-gray-700 dark:text-slate-300">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Supporting Data */}
            {Object.keys(insight.supporting_data).length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">{t('pmr.insights.card.supportingData')}</h5>
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <pre className="text-xs text-gray-600 dark:text-slate-400 whitespace-pre-wrap">
                    {JSON.stringify(insight.supporting_data, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Validation Notes */}
            {insight.validation_notes && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">{t('pmr.insights.card.validationNotes')}</h5>
                <p className="text-sm text-gray-700 dark:text-slate-300">{insight.validation_notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                {/* Validation Buttons */}
                {!insight.validated && (
                  <>
                    <button
                      onClick={() => handleValidateInsight(insight, true)}
                      className="flex items-center space-x-1 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 rounded-md hover:bg-green-200 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3" />
                      <span>{t('pmr.insights.card.validate')}</span>
                    </button>
                    <button
                      onClick={() => handleValidateInsight(insight, false)}
                      className="flex items-center space-x-1 px-3 py-1 text-xs font-medium text-red-700 bg-red-100 dark:bg-red-900/30 rounded-md hover:bg-red-200 transition-colors"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      <span>{t('pmr.insights.card.markInvalid')}</span>
                    </button>
                  </>
                )}

                {/* Apply Button */}
                <button
                  onClick={() => onInsightApply(insight.id)}
                  className="flex items-center space-x-1 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/30 rounded-md hover:bg-blue-200 transition-colors"
                >
                  <Zap className="h-3 w-3" />
                  <span>{t('pmr.insights.card.apply')}</span>
                </button>
              </div>

              {/* Feedback Buttons */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onInsightFeedback(insight.id, 'helpful')}
                  className={`p-1 rounded-md transition-colors ${
                    insight.user_feedback === 'helpful'
                      ? 'text-green-700 bg-green-100 dark:bg-green-900/30'
                      : 'text-gray-400 dark:text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                  }`}
                  title={t('pmr.insights.card.markHelpful')}
                >
                  <ThumbsUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onInsightFeedback(insight.id, 'not_helpful')}
                  className={`p-1 rounded-md transition-colors ${
                    insight.user_feedback === 'not_helpful'
                      ? 'text-red-700 bg-red-100 dark:bg-red-900/30'
                      : 'text-gray-400 dark:text-slate-500 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20'
                  }`}
                  title={t('pmr.insights.card.markNotHelpful')}
                >
                  <ThumbsDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('pmr.insights.title')}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:text-slate-400'
              }`}
              title={t('pmr.insights.filters.toggle')}
            >
              <Filter className="h-4 w-4" />
            </button>
            <button
              onClick={() => onGenerateInsights()}
              disabled={isLoading}
              className="flex items-center space-x-1 px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/30 rounded-md hover:bg-blue-200 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t('pmr.insights.refresh')}</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">{filteredInsights.length}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">{t('pmr.insights.totalInsights')}</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {filteredInsights.filter(i => i.validated).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400">{t('pmr.insights.validated')}</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
              {filteredInsights.filter(i => i.priority === 'high' || i.priority === 'critical').length}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400">{t('pmr.insights.highPriority')}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 space-y-3">
          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{t('pmr.insights.filters.categories')}</label>
            <div className="flex flex-wrap gap-1">
              {['budget', 'schedule', 'resource', 'risk', 'quality'].map(category => (
                <button
                  key={category}
                  onClick={() => {
                    setFilters(prev => ({
                      ...prev,
                      categories: prev.categories.includes(category)
                        ? prev.categories.filter(c => c !== category)
                        : [...prev.categories, category]
                    }))
                  }}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    filters.categories.includes(category)
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {t(`pmr.insights.categories.${category}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('pmr.insights.filters.minConfidence')}: {filters.minConfidence}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={filters.minConfidence}
              onChange={(e) => setFilters(prev => ({ ...prev, minConfidence: parseInt(e.target.value) }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Clear Filters */}
          <button
            onClick={() => setFilters({
              categories: [],
              types: [],
              priorities: [],
              validated: null,
              minConfidence: 0
            })}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            {t('pmr.insights.filters.clearAll')}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center space-x-2 text-gray-500 dark:text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>{t('pmr.insights.generating')}</span>
            </div>
          </div>
        ) : filteredInsights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-slate-400">
            <Brain className="h-8 w-8 mb-2" />
            <p className="text-sm">{t('pmr.insights.noInsights')}</p>
            <button
              onClick={() => onGenerateInsights()}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {t('pmr.insights.generateInsights')}
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {Object.entries(insightsByCategory).map(([category, categoryInsights]) => (
              <div key={category}>
                <div className="flex items-center space-x-2 mb-3">
                  {getCategoryIcon(category)}
                  <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 capitalize">
                    {t(`pmr.insights.categories.${category}`)} ({categoryInsights.length})
                  </h4>
                </div>
                <div className="space-y-3">
                  {categoryInsights.map(renderInsightCard)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AIInsightsPanel