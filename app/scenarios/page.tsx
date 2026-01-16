'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import { getApiUrl } from '../../lib/api'
import CreateScenarioModal from './components/CreateScenarioModal'
import VirtualizedProjectSelector from '../../components/ui/VirtualizedProjectSelector'
import { Plus, BarChart3, TrendingUp, TrendingDown, DollarSign, Clock, Users, AlertTriangle, RefreshCw, Trash2, Edit3, GitBranch, Zap, Target } from 'lucide-react'
import { ResponsiveContainer } from '../../components/ui/molecules/ResponsiveContainer'
import { AdaptiveGrid } from '../../components/ui/molecules/AdaptiveGrid'
import { TouchButton } from '../../components/ui/atoms/TouchButton'

interface Project {
  id: string
  name: string
  status: string
  health: 'green' | 'yellow' | 'red'
  budget?: number | null
  start_date?: string | null
  end_date?: string | null
  created_at: string
}

interface ScenarioAnalysis {
  id: string
  project_id: string
  name: string
  description?: string
  base_scenario_id?: string
  parameter_changes: {
    start_date?: string
    end_date?: string
    budget?: number
    resource_allocations?: Record<string, number>
    milestone_dates?: Record<string, string>
    risk_adjustments?: Record<string, Record<string, number>>
  }
  timeline_impact?: {
    original_duration: number
    new_duration: number
    duration_change: number
    critical_path_affected: boolean
    affected_milestones: string[]
  }
  cost_impact?: {
    original_cost: number
    new_cost: number
    cost_change: number
    cost_change_percentage: number
    affected_categories: string[]
  }
  resource_impact?: {
    utilization_changes: Record<string, number>
    over_allocated_resources: string[]
    under_allocated_resources: string[]
    new_resource_requirements: string[]
  }
  created_by: string
  created_at: string
  updated_at: string
  is_active: boolean
  is_baseline: boolean
}

interface ScenarioComparison {
  scenarios: ScenarioAnalysis[]
  comparison_matrix: Record<string, any>
  recommendations: string[]
}

export default function ScenariosPage() {
  const { session } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioAnalysis[]>([])
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([])
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showComparisonView, setShowComparisonView] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      loadProjectScenarios(selectedProject.id)
    }
  }, [selectedProject])

  const loadProjects = async () => {
    try {
      const response = await fetch(getApiUrl('/projects'), {
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch projects')
      
      const projectsData = await response.json()
      const projectsArray = projectsData.projects || projectsData || []
      setProjects(projectsArray)
      
      // Auto-select first project if available
      if (projectsArray.length > 0 && !selectedProject) {
        setSelectedProject(projectsArray[0])
      }
      
    } catch (err) {
      console.error('Error loading projects:', err)
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const loadProjectScenarios = async (projectId: string) => {
    try {
      const response = await fetch(getApiUrl(`/projects/${projectId}/scenarios`), {
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch scenarios')
      
      const data = await response.json()
      setScenarios(data.scenarios || [])
      
    } catch (err) {
      console.error('Error loading scenarios:', err)
      setError(err instanceof Error ? err.message : 'Failed to load scenarios')
    }
  }

  const compareScenarios = async () => {
    if (selectedScenarios.length < 2) {
      setError('Please select at least 2 scenarios to compare')
      return
    }
    
    try {
      setError(null) // Clear any previous errors
      
      const response = await fetch(getApiUrl('/simulations/what-if/compare'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedScenarios)
      })
      
      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = 'Failed to compare scenarios'
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
        } catch {
          // If response is not JSON, use status text
          errorMessage = `${errorMessage} (${response.status}: ${response.statusText})`
        }
        throw new Error(errorMessage)
      }
      
      const comparisonData = await response.json()
      setComparison(comparisonData)
      setShowComparisonView(true)
      
    } catch (err) {
      console.error('Error comparing scenarios:', err)
      setError(err instanceof Error ? err.message : 'Failed to compare scenarios')
    }
  }

  const deleteScenario = async (scenarioId: string) => {
    if (!confirm('Are you sure you want to delete this scenario?')) return
    
    try {
      const response = await fetch(getApiUrl(`/simulations/what-if/${scenarioId}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) throw new Error('Failed to delete scenario')
      
      // Refresh scenarios list
      if (selectedProject) {
        loadProjectScenarios(selectedProject.id)
      }
      
    } catch (err) {
      console.error('Error deleting scenario:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete scenario')
    }
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
    if (days === 0) return '0 days'
    if (Math.abs(days) === 1) return `${days} day`
    return `${days} days`
  }

  const getImpactColor = (value: number) => {
    if (value > 0) return 'text-red-600'
    if (value < 0) return 'text-green-600'
    return 'text-gray-600'
  }

  const getImpactIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4" />
    if (value < 0) return <TrendingDown className="h-4 w-4" />
    return <Target className="h-4 w-4" />
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="lg:col-span-2 h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <ResponsiveContainer padding="md" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">What-If Scenarios</h1>
            <p className="mt-2 text-gray-600">
              Model the impact of project parameter changes on timeline, cost, and resources
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            {selectedScenarios.length >= 2 ? (
              <TouchButton
                onClick={compareScenarios}
                variant="secondary"
                size="md"
                className="bg-purple-600 text-white hover:bg-purple-700"
                leftIcon={<BarChart3 className="h-4 w-4" />}
              >
                Compare ({selectedScenarios.length})
              </TouchButton>
            ) : selectedScenarios.length === 1 ? (
              <div className="text-sm text-gray-500 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Select one more scenario to compare
              </div>
            ) : null}
            
            <TouchButton
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedProject}
              variant="primary"
              size="md"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New Scenario
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

        <AdaptiveGrid 
          columns={{ mobile: 1, tablet: 1, desktop: 3 }}
          gap="md"
        >
          {/* Project Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Select Project</h3>
            </div>
            <div className="p-6">
              {!Array.isArray(projects) || projects.length === 0 ? (
                <div className="text-center py-8">
                  <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No projects available</p>
                </div>
              ) : (
                <VirtualizedProjectSelector
                  projects={projects}
                  selectedProject={selectedProject}
                  onSelectProject={setSelectedProject}
                  formatCurrency={formatCurrency}
                  height={400}
                  itemHeight={80}
                />
              )}
            </div>
          </div>

          {/* Scenarios List */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Scenarios {selectedProject && `for ${selectedProject.name}`}
                </h3>
                {scenarios.length > 0 && (
                  <button
                    onClick={() => selectedProject && loadProjectScenarios(selectedProject.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-6">
              {!selectedProject ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Select a project to view scenarios</p>
                </div>
              ) : !Array.isArray(scenarios) || scenarios.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No scenarios created yet</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Scenario
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {scenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className={`p-6 rounded-lg border-2 transition-colors ${
                        selectedScenarios.includes(scenario.id)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedScenarios.includes(scenario.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedScenarios([...selectedScenarios, scenario.id])
                              } else {
                                setSelectedScenarios(selectedScenarios.filter(id => id !== scenario.id))
                              }
                            }}
                            className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{scenario.name}</h4>
                            {scenario.description && (
                              <p className="text-sm text-gray-600 mt-1">{scenario.description}</p>
                            )}
                            
                            {/* Impact Summary */}
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {/* Timeline Impact */}
                              {scenario.timeline_impact && (
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <div>
                                    <div className={`text-sm font-medium ${getImpactColor(scenario.timeline_impact.duration_change)}`}>
                                      {getImpactIcon(scenario.timeline_impact.duration_change)}
                                      <span className="ml-1">
                                        {formatDuration(scenario.timeline_impact.duration_change)}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500">Timeline</div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Cost Impact */}
                              {scenario.cost_impact && (
                                <div className="flex items-center space-x-2">
                                  <DollarSign className="h-4 w-4 text-gray-400" />
                                  <div>
                                    <div className={`text-sm font-medium ${getImpactColor(scenario.cost_impact.cost_change)}`}>
                                      {getImpactIcon(scenario.cost_impact.cost_change)}
                                      <span className="ml-1">
                                        {scenario.cost_impact.cost_change_percentage.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500">Budget</div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Resource Impact */}
                              {scenario.resource_impact && (
                                <div className="flex items-center space-x-2">
                                  <Users className="h-4 w-4 text-gray-400" />
                                  <div>
                                    <div className="text-sm font-medium text-gray-700">
                                      {Object.keys(scenario.resource_impact.utilization_changes).length}
                                    </div>
                                    <div className="text-xs text-gray-500">Resources</div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-3 text-xs text-gray-500">
                              Created {new Date(scenario.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {/* TODO: Edit scenario */}}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteScenario(scenario.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </AdaptiveGrid>

        {/* Comparison View */}
        {showComparisonView && comparison && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Scenario Comparison</h3>
                <button
                  onClick={() => setShowComparisonView(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scenario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timeline Impact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost Impact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resource Changes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(comparison?.scenarios || []).map((scenario) => (
                      <tr key={scenario.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{scenario.name}</div>
                          {scenario.description && (
                            <div className="text-sm text-gray-500">{scenario.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {scenario.timeline_impact ? (
                            <div className={`text-sm font-medium ${getImpactColor(scenario.timeline_impact.duration_change)}`}>
                              {formatDuration(scenario.timeline_impact.duration_change)}
                            </div>
                          ) : (
                            <span className="text-gray-400">No change</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {scenario.cost_impact ? (
                            <div className={`text-sm font-medium ${getImpactColor(scenario.cost_impact.cost_change)}`}>
                              {scenario.cost_impact.cost_change_percentage.toFixed(1)}%
                              <div className="text-xs text-gray-500">
                                {formatCurrency(scenario.cost_impact.cost_change)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">No change</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {scenario.resource_impact ? (
                            <div className="text-sm">
                              {Object.keys(scenario.resource_impact.utilization_changes).length} resources affected
                            </div>
                          ) : (
                            <span className="text-gray-400">No change</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {(comparison?.recommendations || []).length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {(comparison?.recommendations || []).map((rec, index) => (
                      <li key={index} className="text-sm text-blue-800">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Create Scenario Modal */}
      {showCreateModal && selectedProject && (
        <CreateScenarioModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          project={selectedProject}
          session={session}
          onScenarioCreated={() => {
            if (selectedProject) {
              loadProjectScenarios(selectedProject.id)
            }
          }}
        />
      )}
      </ResponsiveContainer>
    </AppLayout>
  )
}