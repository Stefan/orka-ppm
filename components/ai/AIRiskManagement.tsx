'use client'

/**
 * AI Risk Management Component
 * Provides intelligent risk analysis, pattern recognition, and mitigation suggestions
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  aiRiskManagementSystem,
  type RiskPattern,
  type RiskEscalationAlert,
  type MitigationStrategy,
  generateRiskInsights
} from '../../lib/ai/risk-management'
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Shield, 
  Zap, 
  Clock, 
  Target, 
  CheckCircle,
  XCircle,
  Info,
  Eye,
  Bell,
  RefreshCw
} from 'lucide-react'

export interface AIRiskManagementProps {
  risks: Array<{
    id: string
    title: string
    category: string
    risk_score: number
    project_id: string
    project_name?: string
    status: string
    created_at: string
  }>
  onRiskUpdate?: (riskId: string, updates: any) => void
  onAlertGenerated?: (alert: RiskEscalationAlert) => void
}

export default function AIRiskManagement({ 
  risks, 
  onRiskUpdate: _onRiskUpdate, 
  onAlertGenerated 
}: AIRiskManagementProps) {
  const [patterns, setPatterns] = useState<RiskPattern[]>([])
  const [alerts, setAlerts] = useState<RiskEscalationAlert[]>([])
  const [strategies, setStrategies] = useState<MitigationStrategy[]>([])
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'patterns' | 'alerts' | 'strategies' | 'insights'>('patterns')
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Load AI risk management data
  const loadAIData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [patternsResponse, alertsResponse, dashboardResponse] = await Promise.all([
        aiRiskManagementSystem.identifyRiskPatterns({
          analysis_period_months: 6,
          include_predictions: true,
          confidence_threshold: 0.7
        }),
        aiRiskManagementSystem.generateEscalationAlerts({
          prediction_horizon_days: 30,
          alert_sensitivity: 'medium',
          include_recommendations: true
        }),
        aiRiskManagementSystem.getDashboardData()
      ])

      setPatterns(patternsResponse.patterns)
      setAlerts(alertsResponse.alerts)
      setDashboardData(dashboardResponse)

      // Notify parent component of new alerts
      alertsResponse.alerts.forEach(alert => {
        if (onAlertGenerated) {
          onAlertGenerated(alert)
        }
      })

    } catch (error) {
      console.error('Failed to load AI risk data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load AI risk analysis')
    } finally {
      setLoading(false)
    }
  }, [onAlertGenerated])

  // Load mitigation strategies for selected risk
  const loadMitigationStrategies = useCallback(async (riskId: string) => {
    const risk = risks.find(r => r.id === riskId)
    if (!risk) return

    try {
      const response = await aiRiskManagementSystem.suggestMitigationStrategies({
        risk_id: riskId,
        risk_category: risk.category,
        risk_score: risk.risk_score,
        project_phase: 'execution' // Could be dynamic based on project data
      })

      setStrategies(response.strategies)
    } catch (error) {
      console.error('Failed to load mitigation strategies:', error)
    }
  }, [risks])

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string, action: string) => {
    try {
      await aiRiskManagementSystem.acknowledgeAlert(alertId, {
        acknowledged_by: 'Current User', // Should come from auth context
        response_action: action as any,
        notes: `Alert acknowledged via dashboard`
      })

      // Update local state
      setAlerts(prev => prev.map(alert => 
        alert.alert_id === alertId 
          ? { ...alert, acknowledged: true, acknowledged_at: new Date().toISOString() }
          : alert
      ))
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadAIData, 5 * 60 * 1000) // 5 minutes
      return () => clearInterval(interval)
    }
    return undefined
  }, [autoRefresh, loadAIData])

  // Initial load
  useEffect(() => {
    loadAIData()
  }, [loadAIData])

  // Load strategies when risk is selected
  useEffect(() => {
    if (selectedRisk) {
      loadMitigationStrategies(selectedRisk)
    }
  }, [selectedRisk, loadMitigationStrategies])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50'
      case 'high': return 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50'
      case 'low': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50'
      default: return 'text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700'
    }
  }

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'immediate': return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
      case 'within_24h': return <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      case 'within_week': return <Eye className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      case 'monitor': return <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      default: return <Info className="h-4 w-4 text-gray-600 dark:text-slate-400" />
    }
  }

  const getPatternTypeIcon = (type: string) => {
    switch (type) {
      case 'recurring': return <RefreshCw className="h-4 w-4 dark:text-slate-400" />
      case 'cascading': return <TrendingUp className="h-4 w-4 dark:text-slate-400" />
      case 'seasonal': return <Clock className="h-4 w-4 dark:text-slate-400" />
      case 'project_phase': return <Target className="h-4 w-4 dark:text-slate-400" />
      case 'resource_dependent': return <Shield className="h-4 w-4 dark:text-slate-400" />
      default: return <Brain className="h-4 w-4 dark:text-slate-400" />
    }
  }

  if (loading && !patterns.length && !alerts.length) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600 dark:text-slate-400">Analyzing risks with AI...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
          <XCircle className="h-5 w-5" />
          <span>AI Risk Analysis Error: {error}</span>
        </div>
        <button 
          onClick={loadAIData}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry Analysis
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* AI Risk Management Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8" />
            <div>
              <h2 className="text-2xl font-bold">AI Risk Management</h2>
              <p className="text-purple-100">
                Intelligent pattern recognition and predictive risk analysis
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm text-purple-100">Model Accuracy</div>
              <div className="text-xl font-bold">
                {dashboardData?.ai_insights?.model_accuracy 
                  ? `${(dashboardData.ai_insights.model_accuracy * 100).toFixed(1)}%`
                  : '85.2%'
                }
              </div>
            </div>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-md transition-colors ${
                autoRefresh 
                  ? 'bg-white dark:bg-slate-800 bg-opacity-20 text-white' 
                  : 'bg-white dark:bg-slate-800 bg-opacity-10 text-purple-100 hover:bg-white dark:bg-slate-800 hover:bg-opacity-20'
              }`}
              title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={loadAIData}
              disabled={loading}
              className="p-2 bg-white dark:bg-slate-800 bg-opacity-10 text-purple-100 rounded-md hover:bg-white dark:bg-slate-800 hover:bg-opacity-20 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* AI Insights Summary */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Active Patterns</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {patterns.length}
                </p>
              </div>
              <Brain className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Escalation Alerts</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {alerts.filter(a => !a.acknowledged).length}
                </p>
              </div>
              <Bell className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Critical Risks</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {alerts.filter(a => a.severity === 'critical').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Prediction Confidence</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {dashboardData.ai_insights?.prediction_confidence 
                    ? `${(dashboardData.ai_insights.prediction_confidence * 100).toFixed(0)}%`
                    : '78%'
                  }
                </p>
              </div>
              <Target className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'patterns', label: 'Risk Patterns', icon: Brain, count: patterns.length },
              { id: 'alerts', label: 'Escalation Alerts', icon: Bell, count: alerts.filter(a => !a.acknowledged).length },
              { id: 'strategies', label: 'Mitigation Strategies', icon: Shield, count: strategies.length },
              { id: 'insights', label: 'AI Insights', icon: Zap, count: 0 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:border-slate-600 dark:hover:border-slate-600'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs rounded-full px-2 py-1">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Risk Patterns Tab */}
          {activeTab === 'patterns' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  Identified Risk Patterns
                </h3>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {patterns.filter(p => p.confidence_score > 0.8).length} high-confidence patterns
                </div>
              </div>
              
              {patterns.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-slate-600" />
                  <p>No risk patterns detected yet.</p>
                  <p className="text-sm">AI needs more historical data to identify patterns.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {patterns.map((pattern) => (
                    <div key={pattern.pattern_id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 dark:bg-slate-700/50">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2 dark:text-slate-300">
                          {getPatternTypeIcon(pattern.pattern_type)}
                          <h4 className="font-medium text-gray-900 dark:text-slate-100">{pattern.pattern_name}</h4>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            pattern.confidence_score > 0.8 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                            pattern.confidence_score > 0.6 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300' :
                            'bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-slate-300'
                          }`}>
                            {(pattern.confidence_score * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">{pattern.description}</p>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-slate-300">Frequency:</span>
                          <span className="ml-1 capitalize dark:text-slate-400">{pattern.frequency}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-slate-300">Occurrences:</span>
                          <span className="ml-1 dark:text-slate-400">{pattern.occurrences_count}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-slate-300">Avg Impact:</span>
                          <span className="ml-1 dark:text-slate-400">{(pattern.average_impact_score * 100).toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-slate-300">Escalation Risk:</span>
                          <span className="ml-1 dark:text-slate-400">{(pattern.escalation_probability * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      
                      {pattern.next_likely_occurrence && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                          <div className="flex items-center space-x-2 text-sm">
                            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="font-medium text-blue-900 dark:text-blue-300">Next Occurrence:</span>
                            <span className="text-blue-700 dark:text-blue-400">
                              {new Date(pattern.next_likely_occurrence.predicted_date).toLocaleDateString()}
                            </span>
                            <span className="text-blue-600 dark:text-blue-400">
                              ({(pattern.next_likely_occurrence.confidence * 100).toFixed(0)}% confidence)
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {pattern.successful_mitigations.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Successful Mitigations:
                          </div>
                          <div className="space-y-1">
                            {pattern.successful_mitigations.slice(0, 2).map((mitigation, index) => (
                              <div key={index} className="text-xs text-gray-600 dark:text-slate-400 flex items-center space-x-2">
                                <CheckCircle className="h-3 w-3 text-green-500 dark:text-green-400" />
                                <span>{mitigation.strategy}</span>
                                <span className="text-green-600 dark:text-green-400">
                                  ({(mitigation.success_rate * 100).toFixed(0)}% success)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Escalation Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  Escalation Alerts
                </h3>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length} high-priority alerts
                </div>
              </div>
              
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-slate-600" />
                  <p>No escalation alerts at this time.</p>
                  <p className="text-sm">AI monitoring is active and will alert you to potential escalations.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div 
                      key={alert.alert_id} 
                      className={`border rounded-lg p-4 ${
                        alert.acknowledged 
                          ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50' 
                          : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start space-x-3">
                          {getUrgencyIcon(alert.urgency)}
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-slate-100">{alert.risk_title}</h4>
                            <p className="text-sm text-gray-600 dark:text-slate-400">{alert.project_name}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          {!alert.acknowledged && (
                            <button
                              onClick={() => acknowledgeAlert(alert.alert_id, 'investigating')}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-slate-300">Current Score:</span>
                          <span className="ml-1 dark:text-slate-400">{(alert.current_risk_score * 100).toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-slate-300">Predicted Score:</span>
                          <span className="ml-1 text-orange-600 dark:text-orange-400">
                            {(alert.predicted_risk_score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-slate-300">Time to Escalation:</span>
                          <span className="ml-1 dark:text-slate-400">{alert.time_to_escalation}</span>
                        </div>
                      </div>
                      
                      {alert.triggering_factors.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Triggering Factors:
                          </div>
                          <div className="space-y-1">
                            {alert.triggering_factors.slice(0, 3).map((factor, index) => (
                              <div key={index} className="text-xs text-gray-600 dark:text-slate-400 flex items-center space-x-2">
                                <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                <span>{factor.factor}</span>
                                <span className="text-orange-600 dark:text-orange-400">
                                  ({factor.current_value} vs {factor.threshold} threshold)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {alert.immediate_actions.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                          <div className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                            Recommended Actions:
                          </div>
                          <div className="space-y-1">
                            {alert.immediate_actions.slice(0, 2).map((action, index) => (
                              <div key={index} className="text-sm text-blue-800 dark:text-blue-300 flex items-center space-x-2">
                                <Target className="h-3 w-3" />
                                <span>{action.action}</span>
                                <span className="text-blue-600 dark:text-blue-400">
                                  (Priority: {action.priority})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {alert.acknowledged && (
                        <div className="mt-3 text-xs text-gray-500 dark:text-slate-500 flex items-center space-x-2">
                          <CheckCircle className="h-3 w-3 text-green-500 dark:text-green-400" />
                          <span>
                            Acknowledged {alert.acknowledged_at ? new Date(alert.acknowledged_at).toLocaleString() : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mitigation Strategies Tab */}
          {activeTab === 'strategies' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  AI-Recommended Mitigation Strategies
                </h3>
                <select
                  value={selectedRisk || ''}
                  onChange={(e) => setSelectedRisk(e.target.value || null)}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a risk to analyze</option>
                  {risks.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {risk.title} ({(risk.risk_score * 100).toFixed(0)}%)
                    </option>
                  ))}
                </select>
              </div>
              
              {!selectedRisk ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-slate-600" />
                  <p>Select a risk to view AI-recommended mitigation strategies.</p>
                </div>
              ) : strategies.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>Analyzing mitigation strategies...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {strategies.map((strategy) => (
                    <div key={strategy.strategy_id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 dark:bg-slate-700/50">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-slate-100">{strategy.strategy_name}</h4>
                          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{strategy.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            strategy.historical_success_rate > 0.8 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                            strategy.historical_success_rate > 0.6 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300' :
                            'bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-slate-300'
                          }`}>
                            {(strategy.historical_success_rate * 100).toFixed(0)}% success rate
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-slate-300">Risk Reduction:</span>
                          <span className="ml-1 text-green-600 dark:text-green-400">
                            {(strategy.average_risk_reduction * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-slate-300">Complexity:</span>
                          <span className={`ml-1 capitalize ${
                            strategy.implementation_complexity === 'low' ? 'text-green-600 dark:text-green-400' :
                            strategy.implementation_complexity === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {strategy.implementation_complexity}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-slate-300">Timeline:</span>
                          <span className="ml-1 dark:text-slate-400">{strategy.typical_implementation_time}</span>
                        </div>
                      </div>
                      
                      {strategy.implementation_steps.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                            Implementation Steps:
                          </div>
                          <div className="space-y-2">
                            {strategy.implementation_steps.slice(0, 3).map((step) => (
                              <div key={step.step_number} className="flex items-start space-x-2 text-sm">
                                <span className="flex-shrink-0 w-5 h-5 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full text-xs flex items-center justify-center">
                                  {step.step_number}
                                </span>
                                <div>
                                  <span className="text-gray-900 dark:text-slate-100">{step.description}</span>
                                  <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                                    Duration: {step.estimated_duration}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {strategy.implementation_steps.length > 3 && (
                              <div className="text-xs text-gray-500 dark:text-slate-500 ml-7">
                                ... and {strategy.implementation_steps.length - 3} more steps
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {strategy.similar_cases.length > 0 && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-md">
                          <div className="text-sm font-medium text-green-900 dark:text-green-300 mb-1">
                            Historical Success Cases:
                          </div>
                          <div className="text-xs text-green-800 dark:text-green-400">
                            {strategy.similar_cases.filter(c => c.outcome === 'successful').length} successful implementations
                            in similar scenarios
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">AI-Generated Insights</h3>
              
              {/* Risk Insights */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-4 flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Key Risk Insights
                </h4>
                
                <div className="space-y-3">
                  {generateRiskInsights(patterns, alerts).map((insight, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        insight.priority === 1 ? 'bg-red-500' :
                        insight.priority === 2 ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}></div>
                      <div>
                        <p className="text-sm text-gray-900 dark:text-slate-100">{insight.insight}</p>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-600 dark:text-slate-400">
                          <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                          {insight.actionable && (
                            <span className="text-green-600 dark:text-green-400">Actionable</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Model Performance */}
              {dashboardData?.ai_insights && (
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-4 flex items-center">
                    <Target className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                    AI Model Performance
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm text-gray-700 dark:text-slate-300 mb-2">Overall Accuracy</div>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${(dashboardData.ai_insights.model_accuracy || 0.85) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium dark:text-slate-100">
                          {((dashboardData.ai_insights.model_accuracy || 0.85) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-700 dark:text-slate-300 mb-2">Prediction Confidence</div>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(dashboardData.ai_insights.prediction_confidence || 0.78) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium dark:text-slate-100">
                          {((dashboardData.ai_insights.prediction_confidence || 0.78) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-xs text-gray-500 dark:text-slate-500">
                    Last model update: {dashboardData.ai_insights.last_model_update 
                      ? new Date(dashboardData.ai_insights.last_model_update).toLocaleDateString()
                      : 'Recently'
                    }
                  </div>
                </div>
              )}
              
              {/* Recommendations */}
              {dashboardData?.recommendations && (
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-4 flex items-center">
                    <Brain className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                    AI Recommendations
                  </h4>
                  
                  <div className="space-y-3">
                    {dashboardData.recommendations.slice(0, 5).map((rec: any, index: number) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-md">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          rec.priority === 1 ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' :
                          rec.priority === 2 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300' :
                          'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                        }`}>
                          {rec.priority}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 dark:text-slate-100">{rec.title}</h5>
                          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{rec.description}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-slate-500">
                            <span className="capitalize">Type: {rec.type}</span>
                            <span>Impact: {rec.estimated_impact}</span>
                            {rec.action_required && (
                              <span className="text-orange-600 dark:text-orange-400">Action Required</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}