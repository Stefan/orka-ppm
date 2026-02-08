'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import MonteCarloVisualization from '../../components/MonteCarloVisualization'
import { getApiUrl } from '../../lib/api/client'
import { ResponsiveContainer } from '../../components/ui/molecules/ResponsiveContainer'
import { AdaptiveGrid } from '../../components/ui/molecules/AdaptiveGrid'
import { TouchButton } from '../../components/ui/atoms/TouchButton'
import { useTranslations } from '@/lib/i18n/context'
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Play, 
  Settings, 
  Clock,
  Target,
  DollarSign,
  Activity
} from 'lucide-react'
import { GuidedTour, useGuidedTour, TourTriggerButton, monteCarloTourSteps } from '@/components/guided-tour'

interface Risk {
  id: string
  name: string
  category: string
  impact_type: string
  distribution_type: string
  distribution_parameters: Record<string, number>
  baseline_impact: number
  correlation_dependencies: string[]
}

interface SimulationConfig {
  risks: Risk[]
  iterations: number
  correlations?: Record<string, Record<string, number>>
  random_seed?: number
  baseline_costs?: Record<string, number>
}

interface SimulationResult {
  simulation_id: string
  status: string
  timestamp: string
  iteration_count: number
  execution_time: number
  convergence_status: boolean
  summary: {
    cost_statistics: {
      mean: number
      std: number
      min: number
      max: number
    }
    schedule_statistics: {
      mean: number
      std: number
      min: number
      max: number
    }
  }
}

export default function MonteCarloPage() {
  const { session } = useAuth()
  const { t } = useTranslations()
  const [activeSimulation, setActiveSimulation] = useState<SimulationResult | null>(null)
  const [simulationHistory, setSimulationHistory] = useState<SimulationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const { isOpen, startTour, closeTour, completeTour, resetAndStartTour, hasCompletedTour } = useGuidedTour('montecarlo-v1')
  const [config, setConfig] = useState<SimulationConfig>({
    risks: [],
    iterations: 10000
  })

  useEffect(() => {
    loadSimulationHistory()
  }, [])

  const loadSimulationHistory = async () => {
    if (!session?.access_token) return

    try {
      // This would be implemented to fetch simulation history
      // For now, we'll use sample data
      const sampleHistory: SimulationResult[] = [
        {
          simulation_id: 'sim_001',
          status: 'completed',
          timestamp: '2025-01-09T10:00:00Z',
          iteration_count: 10000,
          execution_time: 45.2,
          convergence_status: true,
          summary: {
            cost_statistics: {
              mean: 1250000,
              std: 185000,
              min: 950000,
              max: 1850000
            },
            schedule_statistics: {
              mean: 365,
              std: 45,
              min: 280,
              max: 520
            }
          }
        }
      ]
      
      setSimulationHistory(sampleHistory)
      if (sampleHistory.length > 0) {
        setActiveSimulation(sampleHistory[0] || null)
      }
    } catch (err) {
      console.error('Failed to load simulation history:', err)
      setError('Failed to load simulation history')
    }
  }

  const runSimulation = async () => {
    if (!session?.access_token) {
      setError('Authentication required')
      return
    }

    if (config.risks.length === 0) {
      setError('At least one risk is required to run simulation')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(getApiUrl('/api/v1/monte-carlo/simulations/run'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Simulation failed: ${response.status}`)
      }

      const result = await response.json()
      
      // Create simulation result object
      const newSimulation: SimulationResult = {
        simulation_id: result.simulation_id,
        status: result.status,
        timestamp: result.timestamp,
        iteration_count: result.iteration_count,
        execution_time: result.execution_time,
        convergence_status: result.convergence_status,
        summary: result.summary
      }

      setActiveSimulation(newSimulation)
      setSimulationHistory(prev => [newSimulation, ...prev])
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Simulation failed'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const loadRisksFromProject = async () => {
    // This would integrate with the existing risk management system
    // For now, we'll create sample risks
    const sampleRisks: Risk[] = [
      {
        id: 'risk_001',
        name: 'Technical Debt Accumulation',
        category: 'technical',
        impact_type: 'cost',
        distribution_type: 'triangular',
        distribution_parameters: {
          min: 50000,
          mode: 120000,
          max: 250000
        },
        baseline_impact: 120000,
        correlation_dependencies: []
      },
      {
        id: 'risk_002',
        name: 'Resource Unavailability',
        category: 'resource',
        impact_type: 'schedule',
        distribution_type: 'normal',
        distribution_parameters: {
          mean: 30,
          std: 10
        },
        baseline_impact: 30,
        correlation_dependencies: []
      },
      {
        id: 'risk_003',
        name: 'Budget Overrun',
        category: 'cost',
        impact_type: 'cost',
        distribution_type: 'lognormal',
        distribution_parameters: {
          mu: 0.15,
          sigma: 0.3
        },
        baseline_impact: 200000,
        correlation_dependencies: ['risk_001']
      }
    ]

    setConfig(prev => ({ ...prev, risks: sampleRisks }))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDuration = (days: number) => {
    if (days >= 365) {
      return `${(days / 365).toFixed(1)} years`
    } else if (days >= 30) {
      return `${(days / 30).toFixed(1)} months`
    } else {
      return `${days.toFixed(0)} days`
    }
  }

  return (
    <AppLayout>
      <ResponsiveContainer padding="md" className="min-w-0 space-y-6">
        <div data-testid="monte-carlo-page" className="min-w-0">
        {/* Header */}
        <div data-testid="monte-carlo-header" data-tour="montecarlo-voice" className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
          <div>
            <h1 data-testid="monte-carlo-title" className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">{t('monteCarlo.title')}</h1>
            <p className="mt-2 text-gray-700 dark:text-slate-300">
              {t('monteCarlo.subtitle')}
            </p>
          </div>
          
          <div data-tour="montecarlo-ai-scenarios" className="flex flex-wrap gap-2 sm:gap-3 items-center">
            <TourTriggerButton
              onStart={hasCompletedTour ? resetAndStartTour : startTour}
              hasCompletedTour={hasCompletedTour}
              className="shrink-0 whitespace-nowrap"
            />
            <TouchButton
              onClick={() => setShowConfig(!showConfig)}
              variant="secondary"
              size="md"
              leftIcon={<Settings className="h-4 w-4 shrink-0" />}
              className="shrink-0 whitespace-nowrap"
            >
              {t('monteCarlo.configure')}
            </TouchButton>
            
            <TouchButton
              onClick={runSimulation}
              disabled={loading || config.risks.length === 0}
              variant="primary"
              size="md"
              leftIcon={<Play className="h-4 w-4 shrink-0" />}
              loading={loading}
              className="shrink-0 whitespace-nowrap"
            >
              {loading ? t('monteCarlo.running') : t('monteCarlo.runSimulation')}
            </TouchButton>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-800 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        {/* Configuration Panel */}
        {showConfig && (
          <div data-testid="monte-carlo-controls" data-tour="montecarlo-parameters" className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('monteCarlo.simulationConfiguration')}</h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Risk Configuration */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900 dark:text-slate-100">{t('monteCarlo.riskConfiguration')}</h4>
                  <button
                    onClick={loadRisksFromProject}
                    className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    {t('monteCarlo.loadSampleRisks')}
                  </button>
                </div>
                
                {config.risks.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <Target className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
                    <p className="text-gray-700 dark:text-slate-300 mb-4">{t('monteCarlo.noRisksConfigured')}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-300">{t('monteCarlo.loadRisksMessage')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {config.risks.map((risk, index) => (
                      <div key={risk.id} className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900 dark:text-slate-100">{risk.name}</h5>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-700 dark:text-slate-300">
                              <span className="capitalize">{risk.category}</span>
                              <span className="capitalize">{risk.impact_type}</span>
                              <span className="capitalize">{risk.distribution_type}</span>
                              <span>
                                {risk.impact_type === 'cost' 
                                  ? formatCurrency(risk.baseline_impact)
                                  : formatDuration(risk.baseline_impact)
                                }
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setConfig(prev => ({
                                ...prev,
                                risks: prev.risks.filter((_, i) => i !== index)
                              }))
                            }}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Simulation Parameters */}
              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-slate-100 mb-4">Simulation Parameters</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Iterations
                    </label>
                    <input
                      type="number"
                      value={config.iterations}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        iterations: parseInt(e.target.value) || 10000
                      }))}
                      min="1000"
                      max="1000000"
                      step="1000"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">Minimum: 1,000 | Recommended: 10,000+</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Random Seed (Optional)
                    </label>
                    <input
                      type="number"
                      value={config.random_seed || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        random_seed: e.target.value ? parseInt(e.target.value) : 0
                      }))}
                      placeholder="Leave empty for random"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">For reproducible results</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Estimated Runtime
                    </label>
                    <div className="px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded-md text-sm text-gray-700 dark:text-slate-300">
                      {Math.ceil((config.risks.length * config.iterations) / 10000)} seconds
                    </div>
                    <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">Approximate execution time</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simulation Results Summary – 2 cards per row */}
        {activeSimulation && (
          <AdaptiveGrid 
            columns={{ mobile: 1, tablet: 2, desktop: 2 }}
            gap="md"
          >
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('monteCarlo.meanCostImpact')}</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(activeSimulation.summary.cost_statistics.mean)}
                  </p>
                  <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">
                    ±{formatCurrency(activeSimulation.summary.cost_statistics.std)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('monteCarlo.meanScheduleImpact')}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatDuration(activeSimulation.summary.schedule_statistics.mean)}
                  </p>
                  <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">
                    ±{formatDuration(activeSimulation.summary.schedule_statistics.std)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('monteCarlo.iterations')}</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {activeSimulation.iteration_count.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">
                    {activeSimulation.convergence_status ? t('monteCarlo.converged') : t('monteCarlo.notConverged')}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('monteCarlo.executionTime')}</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {activeSimulation.execution_time.toFixed(1)}s
                  </p>
                  <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">
                    {new Date(activeSimulation.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </AdaptiveGrid>
        )}

        {/* Monte Carlo Visualization Component (Charts / Heatmap) */}
        {activeSimulation && (
          <div data-tour="montecarlo-heatmap" className="pt-6">
            <MonteCarloVisualization
              simulationId={activeSimulation.simulation_id}
              session={session}
              onError={setError}
            />
          </div>
        )}

        {/* Simulation History */}
        {simulationHistory.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('monteCarlo.simulationHistory')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('monteCarlo.simulationId')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('monteCarlo.date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('monteCarlo.iterations')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('monteCarlo.meanCost')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('monteCarlo.meanSchedule')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('monteCarlo.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('monteCarlo.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {simulationHistory.map((simulation) => (
                    <tr 
                      key={simulation.simulation_id}
                      className={`hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-600 cursor-pointer transition-colors ${
                        activeSimulation?.simulation_id === simulation.simulation_id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                      }`}
                      onClick={() => setActiveSimulation(simulation)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">
                        {simulation.simulation_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">
                        {new Date(simulation.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">
                        {simulation.iteration_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">
                        {formatCurrency(simulation.summary.cost_statistics.mean)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">
                        {formatDuration(simulation.summary.schedule_statistics.mean)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          simulation.status === 'completed' 
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' 
                            : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
                        }`}>
                          {simulation.status === 'completed' ? t('monteCarlo.completed') : simulation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveSimulation(simulation)
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          {t('monteCarlo.view')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!activeSimulation && simulationHistory.length === 0 && !loading && (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
            <p className="text-gray-700 dark:text-slate-300 mb-4">{t('monteCarlo.noSimulations')}</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              {t('monteCarlo.configureRisksMessage')}
            </p>
            <button
              onClick={() => setShowConfig(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Settings className="h-4 w-4 mr-2" />
              {t('monteCarlo.getStarted')}
            </button>
          </div>
        )}
        </div>
      </ResponsiveContainer>
      <GuidedTour
        steps={monteCarloTourSteps}
        isOpen={isOpen}
        onClose={closeTour}
        onComplete={completeTour}
        tourId="montecarlo-v1"
      />
    </AppLayout>
  )
}