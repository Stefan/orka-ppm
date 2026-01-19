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
import { useTranslations } from '@/lib/i18n/context'

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
  const { t } = useTranslations()
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
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(getApiUrl('/projects'), {
        headers
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
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(getApiUrl(`/projects/${projectId}/scenarios`), {
        headers
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
    if (!confirm(t('scenarios.deleteConfirm'))) return
    
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
      <ResponsiveContainer padding="sm" className="space-y-3 pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('scenarios.title')}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {t('scenarios.subtitle')}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            {selectedScenarios.length >= 2 ? (
              <TouchButton
                onClick={compareScenarios}
                variant="secondary"
                size="sm"
                className="bg-purple-600 text-white hover:bg-purple-700"
                leftIcon={<BarChart3 className="h-4 w-4" />}
              >
                {t('scenarios.compareScenarios')} ({selectedScenarios.length})
              </TouchButton>
            ) : selectedScenarios.length === 1 ? (
              <div className="text-xs text-gray-500 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t('scenarios.selectAtLeast2')}
              </div>
            ) : null}
            
            <TouchButton
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedProject}
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {t('scenarios.createScenario')}
            </TouchButton>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-2">
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-red-800">{error}</span>
            </div>
          </div>
        )}

        <AdaptiveGrid 
          columns={{ mobile: 1, tablet: 1, desktop: 4 }}
          gap="sm"
        >
          {/* Project Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-3 py-2 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">{t('scenarios.selectProject')}</h3>
            </div>
            <div className="p-3">
              {!Array.isArray(projects) || projects.length === 0 ? (
                <div className="text-center py-6">
                  <GitBranch className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">{t('scenarios.errorLoading')}</p>
                </div>
              ) : (
                <VirtualizedProjectSelector
                  projects={projects}
                  selectedProject={selectedProject}
                  onSelectProject={setSelectedProject}
                  formatCurrency={formatCurrency}
                  height={350}
                  itemHeight={70}
                />
              )}
            </div>
          </div>

          {/* Scenarios List */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-3 py-2 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {selectedProject ? t('scenarios.scenariosFor', { projectName: selectedProject.name }) : t('scenarios.scenariosTitle')}
                </h3>
                {scenarios.length > 0 && (
                  <button
                    onClick={() => selectedProject && loadProjectScenarios(selectedProject.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={t('common.refresh')}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-3">
              {!selectedProject ? (
                <div className="text-center py-8">
                  <Target className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">{t('scenarios.selectProject')}</p>
                </div>
              ) : !Array.isArray(scenarios) || scenarios.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-3">{t('scenarios.noScenarios')}</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('scenarios.createFirst')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {scenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        selectedScenarios.includes(scenario.id)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-2 flex-1 min-w-0">
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
                            className="mt-0.5 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-gray-900">{scenario.name}</h4>
                                {scenario.description && (
                                  <p className="text-sm text-gray-600 mt-0.5">{scenario.description}</p>
                                )}
                              </div>
                              <div className="flex items-center space-x-1 flex-shrink-0">
                                <button
                                  onClick={() => {/* TODO: Edit scenario */}}
                                  className="p-1.5 text-gray-600 hover:text-gray-900 rounded transition-colors"
                                  title="Edit scenario"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteScenario(scenario.id)}
                                  className="p-1.5 text-gray-600 hover:text-red-600 rounded transition-colors"
                                  title="Delete scenario"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Impact Summary - Horizontal Layout */}
                            <div className="flex flex-wrap items-center gap-4">
                              {/* Timeline Impact */}
                              {scenario.timeline_impact && (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-xs text-gray-500">Timeline:</span>
                                  <span className={`text-sm font-medium ${getImpactColor(scenario.timeline_impact.duration_change)}`}>
                                    {formatDuration(scenario.timeline_impact.duration_change)}
                                  </span>
                                </div>
                              )}
                              
                              {/* Cost Impact */}
                              {scenario.cost_impact && (
                                <div className="flex items-center gap-1.5">
                                  <DollarSign className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-xs text-gray-500">Budget:</span>
                                  <span className={`text-sm font-medium ${getImpactColor(scenario.cost_impact.cost_change)}`}>
                                    {scenario.cost_impact.cost_change_percentage.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                              
                              {/* Resource Impact */}
                              {scenario.resource_impact && (
                                <div className="flex items-center gap-1.5">
                                  <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-xs text-gray-500">Resources:</span>
                                  <span className="text-sm font-medium text-gray-700">
                                    {Object.keys(scenario.resource_impact.utilization_changes).length}
                                  </span>
                                </div>
                              )}
                              
                              {/* Created Date */}
                              <div className="text-xs text-gray-500 ml-auto">
                                {new Date(scenario.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
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
            <div className="px-3 py-2 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{t('scenarios.scenarioComparison')}</h3>
                <button
                  onClick={() => setShowComparisonView(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors text-xl"
                  aria-label={t('common.close')}
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-3">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        {t('scenarios.scenario')}
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        {t('scenarios.timelineImpact')}
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        {t('scenarios.costImpact')}
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        {t('scenarios.resourceChanges')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(comparison?.scenarios || []).map((scenario) => (
                      <tr key={scenario.id}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{scenario.name}</div>
                          {scenario.description && (
                            <div className="text-xs text-gray-500">{scenario.description}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {scenario.timeline_impact ? (
                            <div className={`text-xs font-medium ${getImpactColor(scenario.timeline_impact.duration_change)}`}>
                              {formatDuration(scenario.timeline_impact.duration_change)}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">{t('scenarios.noChange')}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {scenario.cost_impact ? (
                            <div className={`text-xs font-medium ${getImpactColor(scenario.cost_impact.cost_change)}`}>
                              {scenario.cost_impact.cost_change_percentage.toFixed(1)}%
                              <div className="text-[10px] text-gray-500">
                                {formatCurrency(scenario.cost_impact.cost_change)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">{t('scenarios.noChange')}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {scenario.resource_impact ? (
                            <div className="text-xs">
                              {t('scenarios.resourcesAffected', { count: Object.keys(scenario.resource_impact.utilization_changes).length })}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">{t('scenarios.noChange')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {(comparison?.recommendations || []).length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">{t('scenarios.recommendations')}</h4>
                  <ul className="space-y-0.5">
                    {(comparison?.recommendations || []).map((rec, index) => (
                      <li key={index} className="text-xs text-blue-800">• {rec}</li>
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