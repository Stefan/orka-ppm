'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import MonteCarloVisualization from '../../components/MonteCarloVisualization'
import { getApiUrl } from '../../lib/api/client'
import { ResponsiveContainer } from '../../components/ui/molecules/ResponsiveContainer'
import { AdaptiveGrid } from '../../components/ui/molecules/AdaptiveGrid'
import { TouchButton } from '../../components/ui/atoms/TouchButton'
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Play, 
  Settings, 
  Download,
  RefreshCw,
  Clock,
  Target,
  DollarSign,
  Activity
} from 'lucide-react'

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
  const [activeSimulation, setActiveSimulation] = useState<SimulationResult | null>(null)
  const [simulationHistory, setSimulationHistory] = useState<SimulationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
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
        setActiveSimulation(sampleHistory[0])
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
      const response = await fetch(getApiUrl('/monte-carlo/simulations/run'), {
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
        category: 'financial',
        impact_type: 'cost',
        distribution_type: 'lognormal',
        distribution_parameters: {
          mean: 0.15,
          std: 0.3
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
      <ResponsiveContainer padding="md" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Monte Carlo Risk Analysis</h1>
            <p className="mt-2 text-gray-600">
              Statistical simulation and visualization of project risk impacts
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <TouchButton
              onClick={() => setShowConfig(!showConfig)}
              variant="secondary"
              size="md"
              leftIcon={Settings}
            >
              Configure
            </TouchButton>
            
            <TouchButton
              onClick={runSimulation}
              disabled={loading || config.risks.length === 0}
              variant="primary"
              size="md"
              leftIcon={Play}
              loading={loading}
            >
              {loading ? 'Running...' : 'Run Simulation'}
            </TouchButton>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Configuration Panel */}
        {showConfig && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Simulation Configuration</h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Risk Configuration */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900">Risk Configuration</h4>
                  <button
                    onClick={loadRisksFromProject}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    Load Sample Risks
                  </button>
                </div>
                
                {config.risks.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No risks configured</p>
                    <p className="text-sm text-gray-400">Load risks from your project or add them manually</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {config.risks.map((risk, index) => (
                      <div key={risk.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">{risk.name}</h5>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
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
                            className="text-red-600 hover:text-red-800"
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
                <h4 className="text-md font-medium text-gray-900 mb-4">Simulation Parameters</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum: 1,000 | Recommended: 10,000+</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Random Seed (Optional)
                    </label>
                    <input
                      type="number"
                      value={config.random_seed || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        random_seed: e.target.value ? parseInt(e.target.value) : undefined
                      }))}
                      placeholder="Leave empty for random"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">For reproducible results</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estimated Runtime
                    </label>
                    <div className="px-3 py-2 bg-gray-100 rounded-md text-sm text-gray-700">
                      {Math.ceil((config.risks.length * config.iterations) / 10000)} seconds
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Approximate execution time</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simulation Results Summary */}
        {activeSimulation && (
          <AdaptiveGrid 
            columns={{ mobile: 1, tablet: 2, desktop: 4 }}
            gap="md"
          >
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Mean Cost Impact</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(activeSimulation.summary.cost_statistics.mean)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ±{formatCurrency(activeSimulation.summary.cost_statistics.std)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Mean Schedule Impact</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatDuration(activeSimulation.summary.schedule_statistics.mean)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ±{formatDuration(activeSimulation.summary.schedule_statistics.std)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Iterations</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {activeSimulation.iteration_count.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activeSimulation.convergence_status ? 'Converged' : 'Not converged'}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Execution Time</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {activeSimulation.execution_time.toFixed(1)}s
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(activeSimulation.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </AdaptiveGrid>
        )}

        {/* Monte Carlo Visualization Component */}
        {activeSimulation && (
          <MonteCarloVisualization
            simulationId={activeSimulation.simulation_id}
            session={session}
            onError={setError}
          />
        )}

        {/* Simulation History */}
        {simulationHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Simulation History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Simulation ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Iterations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mean Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mean Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {simulationHistory.map((simulation) => (
                    <tr 
                      key={simulation.simulation_id}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        activeSimulation?.simulation_id === simulation.simulation_id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setActiveSimulation(simulation)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {simulation.simulation_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(simulation.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {simulation.iteration_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(simulation.summary.cost_statistics.mean)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDuration(simulation.summary.schedule_statistics.mean)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          simulation.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {simulation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveSimulation(simulation)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View
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
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No Monte Carlo simulations yet</p>
            <p className="text-sm text-gray-400 mb-6">
              Configure risks and run your first simulation to see statistical analysis
            </p>
            <button
              onClick={() => setShowConfig(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Settings className="h-4 w-4 mr-2" />
              Get Started
            </button>
          </div>
        )}
      </ResponsiveContainer>
    </AppLayout>
  )
}