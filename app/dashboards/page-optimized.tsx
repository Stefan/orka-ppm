'use client'

import React, { useEffect, useState, useMemo, useCallback, Suspense, lazy } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/AppLayout'
import { getApiUrl } from '../../lib/api'
import { 
  Filter, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, DollarSign,
  RefreshCw, Eye, EyeOff, Maximize2, Minimize2, Download, Settings, Bell
} from 'lucide-react'

// Lazy load heavy chart components
const LazyCharts = lazy(() => import('./components/DashboardCharts'))

interface Project {
  id: string
  name: string
  description?: string | null
  status: string
  health: 'green' | 'yellow' | 'red'
  budget?: number | null
  actual_cost?: number | null
  start_date?: string | null
  end_date?: string | null
  portfolio_id: string
  created_at: string
}

interface PortfolioMetrics {
  total_projects: number
  active_projects: number
  completed_projects: number
  health_distribution: { green: number; yellow: number; red: number }
  budget_summary: {
    total_budget: number
    total_actual: number
    variance: number
  }
}

interface KPIs {
  project_success_rate: number
  budget_performance: number
  timeline_performance: number
  average_health_score: number
  resource_efficiency: number
  active_projects_ratio: number
}

export default function DashboardsOptimized() {
  const { session } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null)
  const [kpis, setKPIs] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showCharts, setShowCharts] = useState(false)
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...')

  // Optimized data loading with stages
  useEffect(() => {
    if (session) {
      loadDashboardData()
    }
  }, [session])

  const loadDashboardData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Stage 1: Load essential data first (KPIs)
      setLoadingStage('Loading key metrics...')
      await fetchKPIs()
      
      // Stage 2: Load projects (most important)
      setLoadingStage('Loading projects...')
      await fetchProjects()
      
      // Stage 3: Load portfolio metrics
      setLoadingStage('Loading portfolio data...')
      await fetchPortfolioMetrics()
      
      setLastUpdated(new Date())
      setLoadingStage('Complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Optimized fetch functions with better error handling
  async function fetchProjects() {
    if (!session?.access_token) throw new Error('Not authenticated')
    
    try {
      const response = await fetch(getApiUrl('/projects/'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`)
      }
      
      const data = await response.json()
      setProjects(Array.isArray(data) ? data as Project[] : [])
    } catch (error) {
      console.error('Error fetching projects:', error)
      // Don't throw - allow other data to load
      setProjects([])
    }
  }

  async function fetchPortfolioMetrics() {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/portfolio/metrics'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setPortfolioMetrics(data.metrics as PortfolioMetrics)
      }
    } catch (error) {
      console.error('Error fetching portfolio metrics:', error)
      // Don't throw - allow other data to load
    }
  }

  async function fetchKPIs() {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/portfolio/kpis'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setKPIs(data.kpis as KPIs)
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error)
      // Don't throw - allow other data to load
    }
  }

  // Quick refresh for essential data only
  const quickRefresh = useCallback(async () => {
    if (!session?.access_token) return
    
    try {
      await Promise.all([
        fetchKPIs(),
        fetchProjects()
      ])
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Quick refresh failed:', error)
    }
  }, [session])

  // Critical alerts calculation (optimized)
  const criticalProjects = useMemo(() => {
    return projects.filter(project => project.health === 'red').length
  }, [projects])

  const atRiskProjects = useMemo(() => {
    return projects.filter(project => project.health === 'yellow').length
  }, [projects])

  // Loading state with progress
  if (loading) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600">{loadingStage}</p>
        <div className="w-64 bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ 
              width: loadingStage === 'Initializing...' ? '10%' :
                     loadingStage === 'Loading key metrics...' ? '30%' :
                     loadingStage === 'Loading projects...' ? '60%' :
                     loadingStage === 'Loading portfolio data...' ? '90%' : '100%'
            }}
          >
          </div>
        </div>
      </div>
    </AppLayout>
  )

  if (error) return (
    <AppLayout>
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading dashboard</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button 
                onClick={loadDashboardData}
                className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Optimized Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
              {criticalProjects > 0 && (
                <div className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {criticalProjects} Critical
                </div>
              )}
              {atRiskProjects > 0 && (
                <div className="flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  <Clock className="h-4 w-4 mr-1" />
                  {atRiskProjects} At Risk
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
              <span>{projects.length} projects loaded</span>
              {lastUpdated && (
                <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={quickRefresh}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            
            <button
              onClick={() => setShowCharts(!showCharts)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showCharts ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showCharts ? 'Hide Charts' : 'Show Charts'}
            </button>
          </div>
        </div>

        {/* Quick KPI Cards (Always visible) */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">{kpis.project_success_rate}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Budget Performance</p>
                  <p className="text-2xl font-bold text-blue-600">{kpis.budget_performance}%</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Timeline Performance</p>
                  <p className="text-2xl font-bold text-purple-600">{kpis.timeline_performance}%</p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Health Score</p>
                  <p className="text-2xl font-bold text-orange-600">{kpis.average_health_score}/3</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Resource Efficiency</p>
                  <p className="text-2xl font-bold text-indigo-600">{kpis.resource_efficiency}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Projects</p>
                  <p className="text-2xl font-bold text-red-600">{kpis.active_projects_ratio}%</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </div>
        )}

        {/* Lazy-loaded Charts */}
        {showCharts && (
          <Suspense fallback={
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-gray-600">Loading charts...</span>
              </div>
            </div>
          }
          >
            <LazyCharts 
              projects={projects} 
              portfolioMetrics={portfolioMetrics}
              session={session}
            />
          </Suspense>
        )}

        {/* Quick Projects List (Simplified) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Projects ({projects.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {projects.slice(0, 10).map((project) => (
              <div key={project.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      project.health === 'green' ? 'bg-green-500' :
                      project.health === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    >
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{project.name}</h4>
                      <p className="text-sm text-gray-500">{project.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {project.budget && (
                      <p className="text-sm font-medium text-gray-900">
                        ${project.budget.toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {projects.length > 10 && (
              <div className="px-6 py-4 text-center">
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  View all {projects.length} projects
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}