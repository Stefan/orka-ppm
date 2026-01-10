'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Target, 
  DollarSign, 
  Users, 
  Calendar,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Eye,
  EyeOff,
  Filter,
  RefreshCw,
  Lightbulb,
  Zap,
  BarChart3,
  PieChart,
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
  reportId: string
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
  reportId,
  insights,
  onInsightValidate,
  onInsightApply,
  onGenerateInsights,
  onInsightFeedback,
  isLoading = false,
  className = ''
}) => {
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
      grouped[insight.category].push(insight)
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
    const notes = isValid ? 'Validated by user' : 'Marked as invalid by user'
    onInsightValidate(insight.id, isValid, notes)
  }, [onInsightValidate])

  const getInsightIcon = (type: string, category: string) => {
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
    if (confidence >= 0.8) return 'text-green-600 bg-green-100'
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-100'
      case 'high':
        return 'text-orange-600 bg-orange-100'
      case 'medium':
        return 'text-yellow-600 bg-yellow-100'
      case 'low':
        return 'text-green-600 bg-green-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const renderInsightCard = (insight: AIInsight) => {
    const isExpanded = expandedInsights.has(insight.id)
    
    return (
      <div key={insight.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Insight Header */}
        <div 
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleInsightExpansion(insight.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className="flex-shrink-0 mt-1">
                {getInsightIcon(insight.type, insight.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {insight.title}
                  </h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(insight.priority)}`}>
                    {insight.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {insight.content}
                </p>
                <div className="flex items-center space-x-4 mt-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConfidenceColor(insight.confidence_score)}`}>
                    {Math.round(insight.confidence_score * 100)}% confidence
                  </span>
                  {insight.validated && (
                    <span className="flex items-center text-xs text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Validated
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(insight.generated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 ml-2">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            {/* Full Content */}
            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-2">Details</h5>
              <p className="text-sm text-gray-700">{insight.content}</p>
            </div>

            {/* Predicted Impact */}
            {insight.predicted_impact && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-2">Predicted Impact</h5>
                <p className="text-sm text-gray-700">{insight.predicted_impact}</p>
              </div>
            )}

            {/* Recommended Actions */}
            {insight.recommended_actions.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-2">Recommended Actions</h5>
                <ul className="space-y-1">
                  {insight.recommended_actions.map((action, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Supporting Data */}
            {Object.keys(insight.supporting_data).length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-2">Supporting Data</h5>
                <div className="bg-gray-50 rounded-lg p-3">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                    {JSON.stringify(insight.supporting_data, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Validation Notes */}
            {insight.validation_notes && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-2">Validation Notes</h5>
                <p className="text-sm text-gray-700">{insight.validation_notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                {/* Validation Buttons */}
                {!insight.validated && (
                  <>
                    <button
                      onClick={() => handleValidateInsight(insight, true)}
                      className="flex items-center space-x-1 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3" />
                      <span>Validate</span>
                    </button>
                    <button
                      onClick={() => handleValidateInsight(insight, false)}
                      className="flex items-center space-x-1 px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      <span>Mark Invalid</span>
                    </button>
                  </>
                )}

                {/* Apply Button */}
                <button
                  onClick={() => onInsightApply(insight.id)}
                  className="flex items-center space-x-1 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                >
                  <Zap className="h-3 w-3" />
                  <span>Apply</span>
                </button>
              </div>

              {/* Feedback Buttons */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onInsightFeedback(insight.id, 'helpful')}
                  className={`p-1 rounded-md transition-colors ${
                    insight.user_feedback === 'helpful'
                      ? 'text-green-700 bg-green-100'
                      : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                  }`}
                  title="Mark as helpful"
                >
                  <ThumbsUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onInsightFeedback(insight.id, 'not_helpful')}
                  className={`p-1 rounded-md transition-colors ${
                    insight.user_feedback === 'not_helpful'
                      ? 'text-red-700 bg-red-100'
                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title="Mark as not helpful"
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
    <div className={`bg-white border-l border-gray-200 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI Insights</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Toggle filters"
            >
              <Filter className="h-4 w-4" />
            </button>
            <button
              onClick={() => onGenerateInsights()}
              disabled={isLoading}
              className="flex items-center space-x-1 px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">{filteredInsights.length}</div>
            <div className="text-xs text-gray-500">Total Insights</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600">
              {filteredInsights.filter(i => i.validated).length}
            </div>
            <div className="text-xs text-gray-500">Validated</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-orange-600">
              {filteredInsights.filter(i => i.priority === 'high' || i.priority === 'critical').length}
            </div>
            <div className="text-xs text-gray-500">High Priority</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Categories</label>
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
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Min Confidence: {filters.minConfidence}%
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
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center space-x-2 text-gray-500">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Generating insights...</span>
            </div>
          </div>
        ) : filteredInsights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Brain className="h-8 w-8 mb-2" />
            <p className="text-sm">No insights available</p>
            <button
              onClick={() => onGenerateInsights()}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800"
            >
              Generate insights
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {Object.entries(insightsByCategory).map(([category, categoryInsights]) => (
              <div key={category}>
                <div className="flex items-center space-x-2 mb-3">
                  {getCategoryIcon(category)}
                  <h4 className="text-sm font-medium text-gray-900 capitalize">
                    {category} ({categoryInsights.length})
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