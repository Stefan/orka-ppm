'use client'

import { useState, useEffect } from 'react'
import { 
  Zap, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Users, 
  Target,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react'
import { 
  AIResourceOptimizer, 
  OptimizationAnalysis, 
  OptimizationSuggestion,
  createAIResourceOptimizer
} from '../../lib/ai/resource-optimizer'

export interface AIResourceOptimizerProps {
  authToken?: string
  onOptimizationApplied?: (suggestionId: string) => void
  className?: string
}

export default function AIResourceOptimizerComponent({
  authToken,
  onOptimizationApplied,
  className = ''
}: AIResourceOptimizerProps) {
  const [optimizer] = useState(() => authToken ? createAIResourceOptimizer(authToken) : new AIResourceOptimizer())
  const [analysis, setAnalysis] = useState<OptimizationAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set())
  const [selectedFilters, setSelectedFilters] = useState({
    type: 'all',
    priority: 'all',
    confidence: 0.0
  })
  const [showMetrics, setShowMetrics] = useState(false)
  const [metrics, setMetrics] = useState<any>(null)

  // Auto-refresh analysis every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (analysis && !loading) {
        runAnalysis()
      }
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [analysis, loading])

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await optimizer.analyzeResourceAllocation({
        optimization_goals: {
          maximize_utilization: true,
          minimize_conflicts: true,
          balance_workload: true,
          skill_development: false
        }
      })
      
      setAnalysis(result)
      
      // Requirement 6.1: Analysis should complete within 30 seconds
      if (result.analysis_duration_ms > 30000) {
        console.warn(`Analysis took ${result.analysis_duration_ms}ms - exceeds 30 second requirement`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      console.error('AI Resource Optimization failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async () => {
    try {
      const metricsData = await optimizer.getOptimizationMetrics('7d')
      setMetrics(metricsData)
    } catch (err) {
      console.error('Failed to load metrics:', err)
    }
  }

  const applyOptimization = async (suggestion: OptimizationSuggestion) => {
    try {
      setLoading(true)
      
      const result = await optimizer.applyOptimization(suggestion.id, {
        notify_stakeholders: true,
        implementation_notes: `Applied AI optimization suggestion: ${suggestion.reasoning}`
      })
      
      if (result.status === 'applied') {
        // Remove applied suggestion from the list
        setAnalysis(prev => prev ? {
          ...prev,
          suggestions: prev.suggestions.filter(s => s.id !== suggestion.id)
        } : null)
        
        // Notify parent component
        onOptimizationApplied?.(suggestion.id)
        
        // Show success message
        alert(`Optimization applied successfully! ${result.notifications_sent.length} stakeholders notified.`)
      }
    } catch (err) {
      console.error('Failed to apply optimization:', err)
      alert(`Failed to apply optimization: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleSuggestionExpansion = (suggestionId: string) => {
    setExpandedSuggestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(suggestionId)) {
        newSet.delete(suggestionId)
      } else {
        newSet.add(suggestionId)
      }
      return newSet
    })
  }

  const filteredSuggestions = analysis?.suggestions.filter(suggestion => {
    if (selectedFilters.type !== 'all' && suggestion.type !== selectedFilters.type) return false
    if (selectedFilters.confidence > suggestion.confidence_score) return false
    return true
  }) || []

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50'
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getImpactColor = (score: number) => {
    if (score >= 0.7) return 'text-purple-600 bg-purple-50'
    if (score >= 0.4) return 'text-blue-600 bg-blue-50'
    return 'text-gray-600 bg-gray-50'
  }

  const getPriorityColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-600 bg-green-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'high': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className={`bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AI Resource Optimizer</h2>
              <p className="text-sm text-gray-600">ML-powered resource allocation analysis</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {analysis && (
              <div className="text-sm text-gray-600">
                Analysis: {(analysis.analysis_duration_ms / 1000).toFixed(1)}s
              </div>
            )}
            
            <button
              onClick={() => {
                setShowMetrics(!showMetrics)
                if (!showMetrics && !metrics) loadMetrics()
              }}
              className="flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Metrics
            </button>
            
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Panel */}
      {showMetrics && metrics && (
        <div className="p-6 bg-white border-b border-purple-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics (7 days)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Optimizations Applied</p>
                  <p className="text-2xl font-bold text-green-700">{metrics.total_optimizations_applied}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Avg. Improvement</p>
                  <p className="text-2xl font-bold text-blue-700">{metrics.average_utilization_improvement.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600">Conflicts Resolved</p>
                  <p className="text-2xl font-bold text-yellow-700">{metrics.conflicts_resolved}</p>
                </div>
                <Target className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">Satisfaction Score</p>
                  <p className="text-2xl font-bold text-purple-700">{(metrics.user_satisfaction_score * 100).toFixed(0)}%</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Analysis Failed</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !loading && (
        <div className="p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Opportunities</p>
                  <p className="text-2xl font-bold text-blue-600">{analysis.optimization_opportunities}</p>
                </div>
                <Target className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Potential Improvement</p>
                  <p className="text-2xl font-bold text-green-600">{analysis.potential_utilization_improvement.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Est. Cost Savings</p>
                  <p className="text-2xl font-bold text-purple-600">${analysis.estimated_cost_savings.toLocaleString()}</p>
                </div>
                <BarChart3 className="h-6 w-6 text-purple-500" />
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Confidence</p>
                  <p className="text-2xl font-bold text-indigo-600">{(analysis.overall_confidence * 100).toFixed(0)}%</p>
                </div>
                <CheckCircle className="h-6 w-6 text-indigo-500" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={selectedFilters.type}
                  onChange={(e) => setSelectedFilters(prev => ({ ...prev, type: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="resource_reallocation">Resource Reallocation</option>
                  <option value="skill_optimization">Skill Optimization</option>
                  <option value="conflict_resolution">Conflict Resolution</option>
                  <option value="capacity_planning">Capacity Planning</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Confidence</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={selectedFilters.confidence}
                  onChange={(e) => setSelectedFilters(prev => ({ ...prev, confidence: parseFloat(e.target.value) }))}
                  className="w-24"
                />
                <span className="text-sm text-gray-600 ml-2">{(selectedFilters.confidence * 100).toFixed(0)}%</span>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => setSelectedFilters({ type: 'all', priority: 'all', confidence: 0.0 })}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Optimization Suggestions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Optimization Suggestions ({filteredSuggestions.length})
              </h3>
              <div className="text-sm text-gray-600">
                Reliability: <span className="font-medium capitalize">{analysis.recommendation_reliability}</span>
              </div>
            </div>

            {filteredSuggestions.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No optimization suggestions match your current filters.</p>
                <button
                  onClick={() => setSelectedFilters({ type: 'all', priority: 'all', confidence: 0.0 })}
                  className="mt-2 text-purple-600 hover:text-purple-800"
                >
                  Clear filters to see all suggestions
                </button>
              </div>
            ) : (
              filteredSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h4 className="text-lg font-medium text-gray-900">{suggestion.resource_name}</h4>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full capitalize">
                            {suggestion.type.replace('_', ' ')}
                          </span>
                          {suggestion.conflicts_detected.length > 0 && (
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              {suggestion.conflicts_detected.length} Conflict(s)
                            </span>
                          )}
                        </div>
                        
                        <p className="text-gray-700 mb-4">{suggestion.reasoning}</p>
                        
                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className={`p-3 rounded-lg ${getConfidenceColor(suggestion.confidence_score)}`}>
                            <div className="text-sm font-medium">Confidence</div>
                            <div className="text-lg font-bold">{(suggestion.confidence_score * 100).toFixed(0)}%</div>
                          </div>
                          
                          <div className={`p-3 rounded-lg ${getImpactColor(suggestion.impact_score)}`}>
                            <div className="text-sm font-medium">Impact</div>
                            <div className="text-lg font-bold">{(suggestion.impact_score * 100).toFixed(0)}%</div>
                          </div>
                          
                          <div className={`p-3 rounded-lg ${getPriorityColor(suggestion.effort_required)}`}>
                            <div className="text-sm font-medium">Effort</div>
                            <div className="text-lg font-bold capitalize">{suggestion.effort_required}</div>
                          </div>
                          
                          <div className="p-3 rounded-lg bg-gray-50 text-gray-600">
                            <div className="text-sm font-medium">Utilization Δ</div>
                            <div className="text-lg font-bold">
                              {suggestion.utilization_improvement > 0 ? '+' : ''}{suggestion.utilization_improvement.toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        {/* Benefits and Risks */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h5 className="text-sm font-medium text-green-700 mb-2">Benefits</h5>
                            <ul className="text-sm text-green-600 space-y-1">
                              {suggestion.benefits.map((benefit, index) => (
                                <li key={index} className="flex items-start">
                                  <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                                  {benefit}
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          <div>
                            <h5 className="text-sm font-medium text-red-700 mb-2">Risks</h5>
                            <ul className="text-sm text-red-600 space-y-1">
                              {suggestion.risks.map((risk, index) => (
                                <li key={index} className="flex items-start">
                                  <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                                  {risk}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col space-y-2 ml-6">
                        <button
                          onClick={() => applyOptimization(suggestion)}
                          disabled={loading}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                        >
                          Apply
                        </button>
                        
                        <button
                          onClick={() => toggleSuggestionExpansion(suggestion.id)}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center"
                        >
                          {expandedSuggestions.has(suggestion.id) ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              More
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedSuggestions.has(suggestion.id) && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Implementation Steps */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-3">Implementation Steps</h5>
                            <ol className="text-sm text-gray-600 space-y-2">
                              {suggestion.implementation_steps.map((step, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                                    {index + 1}
                                  </span>
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>

                          {/* Alternative Strategies */}
                          {suggestion.alternative_strategies.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 mb-3">Alternative Strategies</h5>
                              <div className="space-y-3">
                                {suggestion.alternative_strategies.map((strategy) => (
                                  <div key={strategy.strategy_id} className="p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                      <h6 className="text-sm font-medium text-gray-900">{strategy.name}</h6>
                                      <span className="text-xs text-gray-500">{(strategy.confidence_score * 100).toFixed(0)}% confidence</span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">{strategy.description}</p>
                                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                                      <span>Complexity: {strategy.implementation_complexity}</span>
                                      <span>Timeline: {strategy.estimated_timeline}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Conflicts Details */}
                        {suggestion.conflicts_detected.length > 0 && (
                          <div className="mt-6">
                            <h5 className="text-sm font-medium text-red-700 mb-3">Detected Conflicts</h5>
                            <div className="space-y-2">
                              {suggestion.conflicts_detected.map((conflict, index) => (
                                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-red-800 capitalize">
                                      {conflict.type.replace('_', ' ')}
                                    </span>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                      conflict.severity === 'critical' ? 'bg-red-200 text-red-800' :
                                      conflict.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                                      'bg-yellow-200 text-yellow-800'
                                    }`}>
                                      {conflict.severity}
                                    </span>
                                  </div>
                                  <p className="text-sm text-red-700">{conflict.description}</p>
                                  {conflict.affected_projects.length > 0 && (
                                    <div className="mt-2 text-xs text-red-600">
                                      Affected projects: {conflict.affected_projects.join(', ')}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recommended Actions */}
          {analysis.recommended_actions.length > 0 && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Recommended Next Actions</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                {analysis.recommended_actions.map((action, index) => (
                  <li key={index} className="flex items-start">
                    <Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!analysis && !loading && !error && (
        <div className="p-12 text-center">
          <Zap className="h-16 w-16 text-purple-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">AI Resource Optimization</h3>
          <p className="text-gray-600 mb-6">
            Run an analysis to get ML-powered resource allocation recommendations with confidence scores.
          </p>
          <button
            onClick={runAnalysis}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
          >
            Start Analysis
          </button>
        </div>
      )}
    </div>
  )
}