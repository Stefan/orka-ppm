'use client'

// Next.js 16 Dashboard - Compact Grid Layout (Cora PPM Style)
// Stack: Next.js, Tailwind, Recharts
// Design: Grid-based, No unnecessary scrolling, Hover details

import { useEffect, useState, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import { 
  loadDashboardData, 
  clearDashboardCache,
  type QuickStats,
  type KPIs,
  type Project
} from '../../lib/api/dashboard-loader'
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Clock, RefreshCw, BarChart3, Users, FileText } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Dynamic imports for code splitting
const VarianceKPIs = dynamic(() => import('./components/VarianceKPIs'), { ssr: false })

// Compact KPI Card Component
function KPICard({ label, value, change, icon: Icon, color }: any) {
  const isPositive = change >= 0
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}%</p>
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{Math.abs(change)}%</span>
          </div>
        </div>
        <Icon className={`${color} opacity-20`} size={32} />
      </div>
    </div>
  )
}

// Compact Project Card Component (Grid Item)
function ProjectCard({ project }: { project: Project }) {
  const healthColors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 truncate group-hover:text-blue-600">
            {project.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{project.status}</p>
        </div>
        <div className={`w-2 h-2 rounded-full ${healthColors[project.health as keyof typeof healthColors]} flex-shrink-0`}></div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-gray-600">
          <Clock size={12} />
          <span>{new Date(project.end_date).toLocaleDateString()}</span>
        </div>
        {project.budget && (
          <div className="flex items-center gap-1 text-gray-600">
            <DollarSign size={12} />
            <span>${(project.budget / 1000).toFixed(0)}k</span>
          </div>
        )}
      </div>
      
      {/* Hover: Show more details */}
      <div className="mt-2 pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Progress</span>
          <span className="font-medium">{project.progress || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
          <div 
            className="bg-blue-600 h-1.5 rounded-full transition-all" 
            style={{ width: `${project.progress || 0}%` }}
          ></div>
        </div>
      </div>
    </div>
  )
}

// Quick Action Button Component
function QuickActionButton({ icon: Icon, label, onClick, color }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-${color}-500 hover:bg-${color}-50 transition-all group`}
    >
      <Icon className={`text-gray-400 group-hover:text-${color}-600 mb-2`} size={24} />
      <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
    </button>
  )
}

// Compact Variance Trend Chart
function CompactVarianceTrend() {
  // Mock data - replace with real API data
  const data = [
    { month: 'Jan', variance: -5000 },
    { month: 'Feb', variance: 3000 },
    { month: 'Mar', variance: -2000 },
    { month: 'Apr', variance: 8000 },
    { month: 'May', variance: -1000 },
    { month: 'Jun', variance: 4000 },
  ]
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Variance Trend</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="variance" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Main Dashboard Component
export default function CompactDashboard() {
  const { session } = useAuth()
  
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null)
  const [kpis, setKPIs] = useState<KPIs | null>(null)
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [varianceAlertCount, setVarianceAlertCount] = useState(0)

  const loadOptimizedData = useCallback(async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    
    try {
      await loadDashboardData(
        session.access_token,
        (criticalData) => {
          setQuickStats(criticalData.quickStats)
          setKPIs(criticalData.kpis)
          setLoading(false)
        },
        (projects) => {
          setRecentProjects(projects)
        }
      )
    } catch (err) {
      console.error('Dashboard load error:', err)
      // Fallback data
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
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    if (session?.access_token) {
      loadOptimizedData()
    }
  }, [session, loadOptimizedData])

  const quickRefresh = useCallback(async () => {
    if (!session?.access_token) return
    try {
      clearDashboardCache()
      await loadOptimizedData()
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, [session?.access_token, loadOptimizedData])

  // Loading State
  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-[1600px] mx-auto p-4 md:p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* Compact Container - Max width for readability */}
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-4">
        
        {/* Header - Compact, Single Line */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {quickStats?.total_projects || 0} Projects • {quickStats?.active_projects || 0} Active
            </p>
          </div>
          <button
            onClick={quickRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Alert Banner - Compact */}
        {(quickStats?.critical_alerts || varianceAlertCount) ? (
          <div className="flex gap-2">
            {quickStats && quickStats.critical_alerts > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm">
                <AlertTriangle className="text-red-600" size={16} />
                <span className="font-medium text-red-900">{quickStats.critical_alerts} Critical</span>
              </div>
            )}
            {varianceAlertCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                <DollarSign className="text-orange-600" size={16} />
                <span className="font-medium text-orange-900">{varianceAlertCount} Budget Alerts</span>
              </div>
            )}
          </div>
        ) : null}

        {/* TOP: KPI Cards - Compact Grid (5 columns on desktop, responsive) */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            <KPICard
              label="Success Rate"
              value={kpis.project_success_rate || 0}
              change={5.2}
              icon={TrendingUp}
              color="text-green-600"
            />
            <KPICard
              label="Budget"
              value={kpis.budget_performance || 0}
              change={-2.1}
              icon={DollarSign}
              color="text-blue-600"
            />
            <KPICard
              label="Timeline"
              value={kpis.timeline_performance || 0}
              change={3.7}
              icon={Clock}
              color="text-purple-600"
            />
            <KPICard
              label="Active"
              value={kpis.active_projects_ratio || 0}
              change={1.2}
              icon={BarChart3}
              color="text-indigo-600"
            />
            <KPICard
              label="Resources"
              value={kpis.resource_efficiency || 0}
              change={0.8}
              icon={Users}
              color="text-teal-600"
            />
          </div>
        )}

        {/* Variance KPIs - Full Width */}
        <Suspense fallback={<div className="h-24 bg-gray-100 rounded-lg animate-pulse"></div>}>
          <VarianceKPIs session={session} selectedCurrency="USD" />
        </Suspense>

        {/* MIDDLE: Main Content Grid - 2/3 + 1/3 Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Left: Recent Projects Grid (2/3 width) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Recent Projects</h2>
              
              {/* Grid Layout for Projects - No vertical list! */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentProjects.slice(0, 6).map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
              
              {recentProjects.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No projects found</p>
              )}
            </div>
          </div>

          {/* Right: Variance Trend Chart (1/3 width) */}
          <div>
            <CompactVarianceTrend />
            
            {/* Project Health Summary - Compact */}
            {quickStats && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Health</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-gray-600">Healthy</span>
                    </div>
                    <span className="font-semibold text-gray-900">{quickStats.health_distribution?.green || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <span className="text-gray-600">At Risk</span>
                    </div>
                    <span className="font-semibold text-gray-900">{quickStats.health_distribution?.yellow || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-gray-600">Critical</span>
                    </div>
                    <span className="font-semibold text-gray-900">{quickStats.health_distribution?.red || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM: Quick Actions - Compact Button Grid */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <QuickActionButton icon={BarChart3} label="Scenarios" onClick={() => {}} color="blue" />
            <QuickActionButton icon={Users} label="Resources" onClick={() => {}} color="green" />
            <QuickActionButton icon={DollarSign} label="Financials" onClick={() => {}} color="orange" />
            <QuickActionButton icon={FileText} label="Reports" onClick={() => {}} color="purple" />
            <QuickActionButton icon={Clock} label="Timeline" onClick={() => {}} color="indigo" />
            <QuickActionButton icon={TrendingUp} label="Analytics" onClick={() => {}} color="teal" />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
