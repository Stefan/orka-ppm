'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/AppLayout'
import { getApiUrl } from '../../lib/api'
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, DollarSign,
  RefreshCw, Eye, Users, BarChart3
} from 'lucide-react'

interface QuickStats {
  total_projects: number
  active_projects: number
  health_distribution: { green: number; yellow: number; red: number }
  critical_alerts: number
  at_risk_projects: number
}

interface KPIs {
  project_success_rate: number
  budget_performance: number
  timeline_performance: number
  average_health_score: number
  resource_efficiency: number
  active_projects_ratio: number
}

interface Project {
  id: string
  name: string
  status: string
  health: 'green' | 'yellow' | 'red'
  budget?: number | null
  created_at: string
}

export default function UltraFastDashboard() {
  const { session } = useAuth()
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null)
  const [kpis, setKPIs] = useState<KPIs | null>(null)
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Ultra-fast loading - only essential data
  useEffect(() => {
    if (session) {
      loadEssentialData()
    }
  }, [session])

  const loadEssentialData = async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Single optimized endpoint call
      const response = await fetch(getApiUrl('/optimized/dashboard/quick-stats'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setQuickStats(data.quick_stats)
        setKPIs(data.kpis)
        setLastUpdated(new Date())
        
        // Load recent projects in background (non-blocking)
        loadRecentProjects()
      } else {
        throw new Error(`API Error: ${response.status}`)
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      
      // Show fallback data instead of error
      setQuickStats({
        total_projects: 0,
        active_projects: 0,
        health_distribution: { green: 0, yellow: 0, red: 0 },
        critical_alerts: 0,
        at_risk_projects: 0
      })
      setKPIs({
        project_success_rate: 0,
        budget_performance: 0,
        timeline_performance: 0,
        average_health_score: 0,
        resource_efficiency: 0,
        active_projects_ratio: 0
      })
    } finally {
      setLoading(false)
    }
  }

  // Background loading of projects (non-blocking)
  const loadRecentProjects = async () => {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/optimized/dashboard/projects-summary?limit=5'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setRecentProjects(data.projects || [])
      }
    } catch (err) {
      console.error('Projects load error:', err)
      // Fail silently - don't block main dashboard
    }
  }

  // Quick refresh (optimized)
  const quickRefresh = async () => {
    if (!session?.access_token) return
    
    try {
      await loadEssentialData()
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }

  // Memoized calculations for performance
  const healthPercentages = useMemo(() => {
    if (!quickStats) return { healthy: 0, atRisk: 0, critical: 0 }
    
    const total = quickStats.total_projects || 1
    return {
      healthy: Math.round((quickStats.health_distribution.green / total) * 100),
      atRisk: Math.round((quickStats.health_distribution.yellow / total) * 100),
      critical: Math.round((quickStats.health_distribution.red / total) * 100)
    }
  }, [quickStats])

  // Ultra-fast loading state
  if (loading) return (
    <AppLayout>
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Ultra-fast Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
              {quickStats && quickStats.critical_alerts > 0 && (
                <div className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {quickStats.critical_alerts} Critical
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
              {quickStats && <span>{quickStats.total_projects} projects</span>}
              {lastUpdated && (
                <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
              )}
              <span className="flex items-center text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                Live
              </span>
            </div>
          </div>
          
          <button
            onClick={quickRefresh}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Error Banner (if any) */}
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
              <span className="text-sm text-yellow-800">
                Using cached data - {error}
              </span>
            </div>
          </div>
        )}

        {/* Ultra-fast KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <p className="text-sm font-medium text-gray-600">Active Projects</p>
                  <p className="text-2xl font-bold text-indigo-600">{kpis.active_projects_ratio}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
          </div>
        )}

        {/* Quick Health Overview */}
        {quickStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Health Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Health</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm font-medium text-gray-700">Healthy</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-gray-900">{quickStats.health_distribution.green}</span>
                    <span className="text-xs text-gray-500">({healthPercentages.healthy}%)</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                    <span className="text-sm font-medium text-gray-700">At Risk</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-gray-900">{quickStats.health_distribution.yellow}</span>
                    <span className="text-xs text-gray-500">({healthPercentages.atRisk}%)</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                    <span className="text-sm font-medium text-gray-700">Critical</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-gray-900">{quickStats.health_distribution.red}</span>
                    <span className="text-xs text-gray-500">({healthPercentages.critical}%)</span>
                  </div>
                </div>
              </div>
              
              {/* Simple Health Bar */}
              <div className="mt-4">
                <div className="flex h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="bg-green-500" 
                    style={{ width: `${healthPercentages.healthy}%` }}
                  >
                  </div>
                  <div 
                    className="bg-yellow-500" 
                    style={{ width: `${healthPercentages.atRisk}%` }}
                  >
                  </div>
                  <div 
                    className="bg-red-500" 
                    style={{ width: `${healthPercentages.critical}%` }}
                  >
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{quickStats.total_projects}</div>
                  <div className="text-sm text-gray-600">Total Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{quickStats.active_projects}</div>
                  <div className="text-sm text-gray-600">Active Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{quickStats.critical_alerts}</div>
                  <div className="text-sm text-gray-600">Critical Alerts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{quickStats.at_risk_projects}</div>
                  <div className="text-sm text-gray-600">At Risk</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Projects (Loaded in background) */}
        {recentProjects.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Projects</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {recentProjects.map((project) => (
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
                        <p className="text-sm text-gray-500 capitalize">{project.status.replace('-', ' ')}</p>
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
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm font-medium text-gray-700">View Detailed Charts</span>
              </div>
            </button>
            
            <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
              <div className="text-center">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm font-medium text-gray-700">Manage Resources</span>
              </div>
            </button>
            
            <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
              <div className="text-center">
                <Eye className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm font-medium text-gray-700">Generate Report</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}