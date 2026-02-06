'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { 
  Play, 
  Pause, 
  Download, 
  Settings, 
  TrendingUp, 
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import InteractiveChart from '../charts/InteractiveChart'
import { MonteCarloResults } from './types'
import type { DistributionSettings } from '@/types/costbook'
import { getDistributionForecast } from '@/lib/pmr/distribution-forecast'
import { parseSimVoiceCommand, type SimVoiceAction } from '@/lib/pmr/sim-voice-parser'
import { DistributionParamsBlock } from './DistributionParamsBlock'
import { ScenarioHeatmap } from './ScenarioHeatmap'
import { AIScenarioSuggestions } from './AIScenarioSuggestions'
import { VoiceSimButton } from './VoiceSimButton'

export interface MonteCarloParams {
  iterations: number
  confidence_level: number
  analysis_types: ('budget' | 'schedule' | 'resource')[]
  budget_uncertainty?: number
  schedule_uncertainty?: number
  resource_availability?: number
}

interface MonteCarloAnalysisProps {
  reportId: string
  projectId: string
  projectData: {
    baseline_budget: number
    current_spend: number
    baseline_duration: number
    elapsed_time: number
    resource_allocations?: any[]
    duration_start?: string
    duration_end?: string
  }
  onRunSimulation: (params: MonteCarloParams) => Promise<MonteCarloResults>
  onExportResults?: (format: 'csv' | 'json' | 'pdf') => void
  simulationResults?: MonteCarloResults
  isRunning?: boolean
  session: any
}

interface ScenarioConfig {
  id: string
  name: string
  params: MonteCarloParams
  results?: MonteCarloResults
}

export default function MonteCarloAnalysisComponent({
  reportId,
  projectId,
  projectData,
  onRunSimulation,
  onExportResults,
  simulationResults: initialResults,
  isRunning: externalIsRunning = false,
  session
}: MonteCarloAnalysisProps) {
  // State management
  const [params, setParams] = useState<MonteCarloParams>({
    iterations: 10000,
    confidence_level: 0.95,
    analysis_types: ['budget', 'schedule'],
    budget_uncertainty: 0.15,
    schedule_uncertainty: 0.20,
    resource_availability: 0.90
  })
  
  const [simulationResults, setSimulationResults] = useState<MonteCarloResults | undefined>(initialResults)
  const [isRunning, setIsRunning] = useState(externalIsRunning)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [progress, setProgress] = useState(0)
  
  // Scenario comparison
  const [scenarios, setScenarios] = useState<ScenarioConfig[]>([])
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([])
  const [showScenarioComparison, setShowScenarioComparison] = useState(false)

  // Distribution (Forecast-Profil) for period-wise spend
  const defaultDurationStart = projectData.duration_start ?? new Date().toISOString().slice(0, 10)
  const defaultDurationEnd = projectData.duration_end ?? (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 12)
    return d.toISOString().slice(0, 10)
  })()
  const [distributionSettings, setDistributionSettings] = useState<DistributionSettings>({
    profile: 'linear',
    duration_start: defaultDurationStart,
    duration_end: defaultDurationEnd,
    granularity: 'month',
  })
  const [showCO2Column, setShowCO2Column] = useState(false)
  
  // Chart visibility
  const [visibleCharts, setVisibleCharts] = useState({
    distribution: true,
    percentiles: true,
    riskContributions: true,
    timeline: false
  })

  // Update results when external results change
  useEffect(() => {
    if (initialResults) {
      setSimulationResults(initialResults)
    }
  }, [initialResults])

  // Update running state when external state changes
  useEffect(() => {
    setIsRunning(externalIsRunning)
  }, [externalIsRunning])

  // Run simulation (optional override params for "Apply & Run" flow)
  const handleRunSimulation = useCallback(async (overrideParams?: Partial<MonteCarloParams>) => {
    const effectiveParams = overrideParams ? { ...params, ...overrideParams } : params
    setIsRunning(true)
    setError(null)
    setProgress(0)
    if (overrideParams) setParams((prev) => ({ ...prev, ...overrideParams }))

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      const results = await onRunSimulation(effectiveParams)
      
      clearInterval(progressInterval)
      setProgress(100)
      setSimulationResults(results)
      
      // Reset progress after a delay
      setTimeout(() => setProgress(0), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run simulation')
      console.error('Simulation error:', err)
    } finally {
      setIsRunning(false)
    }
  }, [params, onRunSimulation])

  // Save current configuration as scenario
  const handleSaveScenario = useCallback(() => {
    const scenarioName = prompt('Enter scenario name:')
    if (!scenarioName) return

    const newScenario: ScenarioConfig = {
      id: `scenario_${Date.now()}`,
      name: scenarioName,
      params: { ...params },
      results: simulationResults
    }

    setScenarios(prev => [...prev, newScenario])
  }, [params, simulationResults])

  // Load scenario
  const handleLoadScenario = useCallback((scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId)
    if (scenario) {
      setParams(scenario.params)
      if (scenario.results) {
        setSimulationResults(scenario.results)
      }
    }
  }, [scenarios])

  // Toggle scenario selection for comparison
  const toggleScenarioSelection = useCallback((scenarioId: string) => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioId)
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    )
  }, [])

  // Voice command handler
  const handleVoiceCommand = useCallback((cmd: SimVoiceAction) => {
    if (cmd.action === 'set_param') {
      setParams((prev) => ({ ...prev, [cmd.param]: cmd.value }))
    } else if (cmd.action === 'run_scenario') {
      const scenario = scenarios.find(
        (s) => s.name.toLowerCase().includes(cmd.scenarioName.toLowerCase())
      )
      if (scenario) {
        handleLoadScenario(scenario.id)
      }
    } else if (cmd.action === 'run_simulation') {
      handleRunSimulation()
    }
  }, [scenarios, handleLoadScenario, handleRunSimulation])

  // Apply scenario from heatmap (load params + results, optional gamification)
  const handleApplyScenarioFromHeatmap = useCallback((scenarioId: string) => {
    const scenario = scenarios.find((s) => s.id === scenarioId)
    if (scenario) {
      setParams(scenario.params)
      if (scenario.results) setSimulationResults(scenario.results)
    }
  }, [scenarios])

  // Export results
  const handleExport = useCallback((format: 'csv' | 'json' | 'pdf') => {
    if (onExportResults) {
      onExportResults(format)
    } else if (simulationResults) {
      // Default export implementation
      const dataStr = JSON.stringify(simulationResults, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `monte-carlo-results-${reportId}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  }, [simulationResults, onExportResults, reportId])
  // Prepare chart data from simulation results
  const prepareChartData = useCallback(() => {
    if (!simulationResults) return null

    const budgetAnalysis = simulationResults.results?.budget_analysis
    const scheduleAnalysis = simulationResults.results?.schedule_analysis
    const resourceAnalysis = simulationResults.results?.resource_analysis

    // Distribution data for histogram
    const distributionData = []
    if (budgetAnalysis?.percentiles) {
      Object.entries(budgetAnalysis.percentiles).forEach(([key, value]) => {
        if (key.startsWith('p')) {
          distributionData.push({
            name: key.toUpperCase(),
            value: typeof value === 'number' ? value : 0,
            type: 'budget'
          })
        }
      })
    }

    // Percentile comparison data
    const percentileData = [
      {
        name: 'P10',
        budget: budgetAnalysis?.percentiles?.p10 || 0,
        schedule: scheduleAnalysis?.percentiles?.p10 || 0
      },
      {
        name: 'P50 (Median)',
        budget: budgetAnalysis?.percentiles?.p50 || 0,
        schedule: scheduleAnalysis?.percentiles?.p50 || 0
      },
      {
        name: 'P90',
        budget: budgetAnalysis?.percentiles?.p90 || 0,
        schedule: scheduleAnalysis?.percentiles?.p90 || 0
      },
      {
        name: 'P95',
        budget: budgetAnalysis?.percentiles?.p95 || 0,
        schedule: scheduleAnalysis?.percentiles?.p95 || 0
      }
    ]

    // Risk contributions data
    const riskContributionsData = budgetAnalysis?.risk_contributions?.slice(0, 10).map((risk: any) => ({
      name: risk.risk_name || risk.risk_id,
      contribution: Math.abs(risk.variance || 0),
      impact: risk.mean_impact || 0
    })) || []

    return {
      distributionData,
      percentileData,
      riskContributionsData
    }
  }, [simulationResults])

  const chartData = prepareChartData()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" />
            Monte Carlo Risk Analysis
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Predictive simulation for budget, schedule, and resource risks
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </button>

          {scenarios.length > 0 && (
            <button
              onClick={() => setShowScenarioComparison(!showScenarioComparison)}
              className="flex items-center px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Compare Scenarios
            </button>
          )}

          <AIScenarioSuggestions
            projectId={projectId}
            onApply={(p) => setParams((prev) => ({ ...prev, ...p }))}
            onApplyAndRun={(p) => handleRunSimulation(p)}
            disabled={isRunning}
          />
          <VoiceSimButton
            onCommand={handleVoiceCommand}
            disabled={isRunning}
            showFeedback
          />
          <button
            onClick={handleRunSimulation}
            disabled={isRunning}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Simulation
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isRunning && progress > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Simulation Progress</span>
            <span className="text-sm text-gray-600 dark:text-slate-400">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300">Simulation Error</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
      {/* Configuration Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">Simulation Parameters</h4>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Iterations
                  <span className="ml-1 text-gray-400 dark:text-slate-500" title="Number of simulation runs">
                    <Info className="h-3 w-3 inline" />
                  </span>
                </label>
                <input
                  type="number"
                  value={params.iterations}
                  onChange={(e) => setParams(prev => ({ ...prev, iterations: parseInt(e.target.value) || 10000 }))}
                  min="1000"
                  max="100000"
                  step="1000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Recommended: 10,000 - 50,000</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Confidence Level
                </label>
                <select
                  value={params.confidence_level}
                  onChange={(e) => setParams(prev => ({ ...prev, confidence_level: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="0.90">90%</option>
                  <option value="0.95">95%</option>
                  <option value="0.99">99%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Analysis Types
                </label>
                <div className="space-y-2">
                  {(['budget', 'schedule', 'resource'] as const).map(type => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={params.analysis_types.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setParams(prev => ({
                              ...prev,
                              analysis_types: [...prev.analysis_types, type]
                            }))
                          } else {
                            setParams(prev => ({
                              ...prev,
                              analysis_types: prev.analysis_types.filter(t => t !== type)
                            }))
                          }
                        }}
                        className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Forecast-Profil (Distribution) */}
            <div className="mt-4">
              <DistributionParamsBlock
                value={distributionSettings}
                onChange={setDistributionSettings}
                durationStart={projectData.duration_start}
                durationEnd={projectData.duration_end}
                disabled={isRunning}
              />
            </div>

            {/* Advanced Parameters */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100"
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                Advanced Parameters
              </button>

              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Budget Uncertainty (%)
                    </label>
                    <input
                      type="number"
                      value={(params.budget_uncertainty || 0.15) * 100}
                      onChange={(e) => setParams(prev => ({ 
                        ...prev, 
                        budget_uncertainty: parseFloat(e.target.value) / 100 || 0.15 
                      }))}
                      min="0"
                      max="100"
                      step="5"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Schedule Uncertainty (%)
                    </label>
                    <input
                      type="number"
                      value={(params.schedule_uncertainty || 0.20) * 100}
                      onChange={(e) => setParams(prev => ({ 
                        ...prev, 
                        schedule_uncertainty: parseFloat(e.target.value) / 100 || 0.20 
                      }))}
                      min="0"
                      max="100"
                      step="5"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Resource Availability (%)
                    </label>
                    <input
                      type="number"
                      value={(params.resource_availability || 0.90) * 100}
                      onChange={(e) => setParams(prev => ({ 
                        ...prev, 
                        resource_availability: parseFloat(e.target.value) / 100 || 0.90 
                      }))}
                      min="0"
                      max="100"
                      step="5"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={handleSaveScenario}
                disabled={!simulationResults}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save as Scenario
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowSettings(false)
                    handleRunSimulation()
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply & Run
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Results Summary */}
      {simulationResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Budget Summary */}
          {simulationResults.results?.budget_analysis && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Budget Analysis</h4>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  (simulationResults.results.budget_analysis.probability_within_budget || 0) > 0.8
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700'
                    : (simulationResults.results.budget_analysis.probability_within_budget || 0) > 0.5
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700'
                }`}>
                  {((simulationResults.results.budget_analysis.probability_within_budget || 0) * 100).toFixed(0)}% On Budget
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Expected Cost:</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    ${(simulationResults.results.budget_analysis.expected_final_cost || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Variance:</span>
                  <span className={`font-medium ${
                    (simulationResults.results.budget_analysis.variance_percentage || 0) > 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {(simulationResults.results.budget_analysis.variance_percentage || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-400">P95 Cost:</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    ${(simulationResults.results.budget_analysis.percentiles?.p95 || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Summary */}
          {simulationResults.results?.schedule_analysis && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Schedule Analysis</h4>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  (simulationResults.results.schedule_analysis.probability_on_time || 0) > 0.8
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700'
                    : (simulationResults.results.schedule_analysis.probability_on_time || 0) > 0.5
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700'
                }`}>
                  {((simulationResults.results.schedule_analysis.probability_on_time || 0) * 100).toFixed(0)}% On Time
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Expected Duration:</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    {(simulationResults.results.schedule_analysis.expected_final_duration || 0).toFixed(0)} days
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Variance:</span>
                  <span className={`font-medium ${
                    (simulationResults.results.schedule_analysis.variance_percentage || 0) > 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {(simulationResults.results.schedule_analysis.variance_percentage || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-400">P95 Duration:</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    {(simulationResults.results.schedule_analysis.percentiles?.p95 || 0).toFixed(0)} days
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Resource Summary */}
          {simulationResults.results?.resource_analysis && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Resource Analysis</h4>
                <div className="px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700">
                  {simulationResults.results.resource_analysis.total_resources || 0} Resources
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Conflict Risk:</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    {((simulationResults.results.resource_analysis.conflict_probability?.overall_risk || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mt-2">
                  {simulationResults.results.resource_analysis.recommendations?.slice(0, 2).map((rec: string, idx: number) => (
                    <div key={idx} className="flex items-start mt-1">
                      <span className="text-blue-600 dark:text-blue-400 mr-1">•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Period-wise Forecast (Distribution) */}
          {distributionSettings && projectData.baseline_budget > 0 && (() => {
            const forecast = getDistributionForecast(
              projectData.baseline_budget,
              distributionSettings.duration_start,
              distributionSettings.duration_end,
              distributionSettings,
              projectData.current_spend
            )
            if (forecast.error || forecast.periods.length === 0) return null
            return (
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Forecast (Spend per period)</h4>
                <div className="text-sm text-gray-600 dark:text-slate-400 mb-1">Peak cash: ${forecast.peakCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">Total: ${forecast.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {forecast.periods.length} periods</div>
              </div>
            )
          })()}

          {/* Simulation Info */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Simulation Info</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-slate-400">Iterations:</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {(simulationResults.iterations || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-slate-400">Confidence:</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {((simulationResults.confidence_level || 0.95) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-slate-400">Processing Time:</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {((simulationResults.processing_time_ms || 0) / 1000).toFixed(2)}s
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-slate-400">Generated:</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {new Date(simulationResults.generated_at || Date.now()).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Interactive Visualizations */}
      {simulationResults && chartData && (
        <div className="space-y-6">
          {/* Chart Visibility Controls */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Visualization Options</h4>
              <div className="flex gap-2">
                {Object.entries(visibleCharts).map(([key, visible]) => (
                  <button
                    key={key}
                    onClick={() => setVisibleCharts(prev => ({ ...prev, [key]: !visible }))}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      visible
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                    }`}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Distribution Chart */}
          {visibleCharts.distribution && chartData.distributionData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">Probability Distribution</h4>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  Distribution of possible outcomes across percentiles
                </p>
              </div>
              <div className="p-6">
                <InteractiveChart
                  type="bar"
                  data={chartData.distributionData}
                  dataKey="value"
                  nameKey="name"
                  title=""
                  height={300}
                  colors={['#3B82F6', '#10B981', '#F59E0B', '#EF4444']}
                  enableFiltering={true}
                  enableExport={true}
                  showLegend={true}
                />
              </div>
            </div>
          )}

          {/* Percentile Comparison Chart */}
          {visibleCharts.percentiles && chartData.percentileData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">Budget vs Schedule Percentiles</h4>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  Comparative analysis of budget and schedule outcomes
                </p>
              </div>
              <div className="p-6">
                <InteractiveChart
                  type="line"
                  data={chartData.percentileData}
                  dataKey="budget"
                  nameKey="name"
                  title=""
                  height={300}
                  colors={['#3B82F6', '#10B981']}
                  enableBrushing={true}
                  enableExport={true}
                  showLegend={true}
                />
              </div>
            </div>
          )}

          {/* Risk Contributions Chart */}
          {visibleCharts.riskContributions && chartData.riskContributionsData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">Top Risk Contributors</h4>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  Risks with the highest impact on overall uncertainty
                </p>
              </div>
              <div className="p-6">
                <InteractiveChart
                  type="bar"
                  data={chartData.riskContributionsData}
                  dataKey="contribution"
                  nameKey="name"
                  title=""
                  height={300}
                  colors={['#EF4444', '#F59E0B', '#10B981']}
                  enableFiltering={true}
                  enableExport={true}
                  showLegend={false}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scenario Comparison */}
      {showScenarioComparison && scenarios.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">Scenario Comparison</h4>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              Compare different simulation scenarios side by side
            </p>
          </div>

          <div className="p-6">
            {scenarios.filter((s) => s.results?.results).length >= 2 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Heatmap</h5>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={showCO2Column}
                      onChange={(e) => setShowCO2Column(e.target.checked)}
                    />
                    CO₂ anzeigen
                  </label>
                </div>
                <ScenarioHeatmap
                  scenarios={scenarios}
                  baselineIndex={0}
                  showCO2={showCO2Column}
                  onApplyScenario={handleApplyScenarioFromHeatmap}
                />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenarios.map(scenario => (
                <div
                  key={scenario.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedScenarios.includes(scenario.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                  }`}
                  onClick={() => toggleScenarioSelection(scenario.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-gray-900 dark:text-slate-100">{scenario.name}</h5>
                    <input
                      type="checkbox"
                      checked={selectedScenarios.includes(scenario.id)}
                      onChange={() => {}}
                      className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded"
                    />
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-400">Iterations:</span>
                      <span className="font-medium">{scenario.params.iterations.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-400">Confidence:</span>
                      <span className="font-medium">{(scenario.params.confidence_level * 100).toFixed(0)}%</span>
                    </div>
                    {scenario.results && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-slate-400">Expected Cost:</span>
                        <span className="font-medium">
                          ${(scenario.results.results?.budget_analysis?.expected_final_cost || 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLoadScenario(scenario.id)
                      }}
                      className="flex-1 px-3 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600"
                    >
                      Load
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setScenarios(prev => prev.filter(s => s.id !== scenario.id))
                      }}
                      className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 rounded hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {selectedScenarios.length >= 2 && (() => {
              const toCompare = scenarios.filter(s => selectedScenarios.includes(s.id))
              const hasResults = toCompare.every(s => s.results?.results)
              if (!hasResults) {
                return (
                  <div className="mt-6 p-4 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-800">
                      Load and run each scenario to see comparison. Select scenarios that have results.
                    </p>
                  </div>
                )
              }
              const budgetP50 = (s: ScenarioConfig) => s.results?.results?.budget_analysis?.percentiles?.p50 ?? 0
              const budgetP90 = (s: ScenarioConfig) => s.results?.results?.budget_analysis?.percentiles?.p90 ?? 0
              const expectedCost = (s: ScenarioConfig) => s.results?.results?.budget_analysis?.expected_final_cost ?? s.results?.results?.budget_analysis?.percentiles?.p50 ?? 0
              const scheduleP50 = (s: ScenarioConfig) => s.results?.results?.schedule_analysis?.percentiles?.p50 ?? 0
              return (
                <div className="mt-6 overflow-x-auto">
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Side-by-side comparison</h5>
                  <table className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-slate-700">
                        <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-slate-700 font-medium">Scenario</th>
                        <th className="text-right px-3 py-2 border-b border-gray-200 dark:border-slate-700 font-medium">P50 (Budget)</th>
                        <th className="text-right px-3 py-2 border-b border-gray-200 dark:border-slate-700 font-medium">P90 (Budget)</th>
                        <th className="text-right px-3 py-2 border-b border-gray-200 dark:border-slate-700 font-medium">Expected Cost</th>
                        <th className="text-right px-3 py-2 border-b border-gray-200 dark:border-slate-700 font-medium">P50 (Schedule)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toCompare.map(s => (
                        <tr key={s.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className="text-right px-3 py-2">${Number(budgetP50(s)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="text-right px-3 py-2">${Number(budgetP90(s)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="text-right px-3 py-2">${Number(expectedCost(s)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="text-right px-3 py-2">{Number(scheduleP50(s)).toLocaleString(undefined, { maximumFractionDigits: 0 })} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        </div>
      )}
      {/* Export Options */}
      {simulationResults && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">Export Results</h4>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleExport('json')}
              className="flex items-center px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as PDF
            </button>
          </div>

          <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
            <h5 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Export Includes:</h5>
            <ul className="text-sm text-gray-600 dark:text-slate-400 space-y-1">
              <li>• Complete simulation results and statistics</li>
              <li>• Risk contribution analysis</li>
              <li>• Percentile distributions</li>
              <li>• Confidence intervals</li>
              <li>• Scenario configurations (if applicable)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!simulationResults && !isRunning && !error && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-12 text-center">
          <BarChart3 className="h-16 w-16 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No Simulation Results</h4>
          <p className="text-gray-600 dark:text-slate-400 mb-6">
            Configure parameters and run a Monte Carlo simulation to analyze project risks
          </p>
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure & Run Simulation
          </button>
        </div>
      )}

      {/* Saved Scenarios List */}
      {scenarios.length > 0 && !showScenarioComparison && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Saved Scenarios ({scenarios.length})</h4>
            <button
              onClick={() => setShowScenarioComparison(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              View All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {scenarios.slice(0, 5).map(scenario => (
              <button
                key={scenario.id}
                onClick={() => handleLoadScenario(scenario.id)}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
              >
                {scenario.name}
              </button>
            ))}
            {scenarios.length > 5 && (
              <button
                onClick={() => setShowScenarioComparison(true)}
                className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                +{scenarios.length - 5} more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
