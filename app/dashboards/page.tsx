'use client'

// Next.js 16 Dashboard - Ultra-Compact Grid Layout (Cora PPM Style)
// Stack: Next.js 16, Tailwind CSS, Recharts, lucide-react
// Design: Grid-based, Mobile-first, Hover details, Minimal scrolling
// Note: AppLayout has TopBar, so available height is less than 100vh

import { useEffect, useState, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import { useTranslations } from '@/lib/i18n/context'
import { 
  loadDashboardData, 
  clearDashboardCache,
  type QuickStats,
  type KPIs,
  type Project
} from '../../lib/api/dashboard-loader'
import { 
  TrendingUp, TrendingDown, AlertTriangle, DollarSign, Clock, RefreshCw, 
  BarChart3, Users, FileText, ChevronDown, X, Filter 
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Dynamic imports for code splitting (existing pattern maintained)
const VarianceKPIs = dynamic(() => import('./components/VarianceKPIs'), { ssr: false })
const VarianceTrends = dynamic(() => import('./components/VarianceTrends'), { ssr: false })
const VarianceAlerts = dynamic(() => import('./components/VarianceAlerts'), { ssr: false })

// Ultra-Compact KPI Card Component - standardized font sizes
function KPICard({ label, value, change, icon: Icon, color }: any) {
  const isPositive = change >= 0
  return (
    <div className="bg-white rounded border border-gray-200 px-2 py-1 hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer group">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide truncate leading-tight mb-0.5">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-sm font-bold leading-none ${color}`}>{value}%</p>
            <span className={`text-[10px] font-medium leading-none ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '↑' : '↓'}{Math.abs(change)}%
            </span>
          </div>
        </div>
        <Icon className={`${color} opacity-20 group-hover:opacity-40 transition-opacity flex-shrink-0`} size={20} />
      </div>
    </div>
  )
}

// Ultra-Compact Project Card Component - 20% height
function ProjectCard({ project }: { project: Project }) {
  const healthColors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  }
  
  return (
    <div className="bg-white rounded border border-gray-200 p-1.5 hover:shadow-md hover:border-blue-400 transition-all duration-200 cursor-pointer group">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-xs text-gray-900 truncate group-hover:text-blue-600 transition-colors leading-tight">
            {project.name}
          </h3>
        </div>
        <div className={`w-1.5 h-1.5 rounded-full ${healthColors[project.health as keyof typeof healthColors]} flex-shrink-0`}></div>
      </div>
    </div>
  )
}

// Quick Action Button Component - standardized font sizes
function QuickActionButton({ icon: Icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center p-3 md:p-4 bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all duration-200 group"
    >
      <Icon className="text-gray-400 group-hover:text-blue-600 mb-2 transition-colors" size={20} />
      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{label}</span>
    </button>
  )
}

// Ultra-Compact Alert Chip Component - standardized font sizes
function AlertChip({ alert, onDismiss }: { alert: any, onDismiss: (id: string) => void }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  const severityConfig = {
    critical: { 
      bg: 'bg-red-100', 
      border: 'border-red-300', 
      text: 'text-red-800',
      dot: 'bg-red-600'
    },
    warning: { 
      bg: 'bg-orange-100', 
      border: 'border-orange-300', 
      text: 'text-orange-800',
      dot: 'bg-orange-600'
    },
    info: { 
      bg: 'bg-blue-100', 
      border: 'border-blue-300', 
      text: 'text-blue-800',
      dot: 'bg-blue-600'
    }
  }
  
  const severity = alert.severity || 'warning'
  const config = severityConfig[severity as keyof typeof severityConfig]
  
  return (
    <div 
      className={`${config.bg} border ${config.border} rounded-md px-2 py-1.5 flex items-center gap-2 group hover:shadow-md transition-all relative`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${config.dot} flex-shrink-0`}></div>
      <div className="flex flex-col min-w-0">
        <span className={`text-xs font-semibold ${config.text}`}>{alert.title}</span>
        <span className={`text-[10px] ${config.text} opacity-70 truncate`}>{alert.description}</span>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className={`p-0.5 rounded hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${config.text}`}
      >
        <X size={12} />
      </button>
      
      {/* Tooltip on hover */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-20 whitespace-nowrap">
          {alert.description}
          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
}

// Filter Dropdown Component - standardized font sizes
function FilterDropdown({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const options = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year']
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-xs"
      >
        <Filter size={14} />
        <span className="hidden sm:inline">{value}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                onChange(option)
                setIsOpen(false)
              }}
              className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                value === option ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Main Dashboard Component
export default function CompactDashboard() {
  const { session } = useAuth()
  const { t } = useTranslations()
  
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null)
  const [kpis, setKPIs] = useState<KPIs | null>(null)
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [varianceAlertCount, setVarianceAlertCount] = useState(0)
  const [timeFilter, setTimeFilter] = useState('Last 30 days')
  const [alerts, setAlerts] = useState<any[]>([
    { id: '1', title: 'Budget Overrun', description: 'Project Alpha exceeded budget by 15%', severity: 'critical' },
    { id: '2', title: 'Timeline Delay', description: 'Project Beta is 2 weeks behind schedule', severity: 'warning' },
    { id: '3', title: 'Resource Conflict', description: 'Team member assigned to multiple projects', severity: 'warning' },
  ])

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

  const handleFilterChange = useCallback((newFilter: string) => {
    setTimeFilter(newFilter)
    loadOptimizedData()
  }, [loadOptimizedData])

  const handleDismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }, [])

  // Loading State - Mobile-first responsive
  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-[1600px] mx-auto p-3 sm:p-4 md:p-6">
          <div className="animate-pulse space-y-3 md:space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 md:h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
              <div className="lg:col-span-2 h-48 md:h-64 bg-gray-200 rounded"></div>
              <div className="h-48 md:h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* Compact container with reduced spacing + bottom margin for quick actions */}
      <div className="max-w-[1600px] mx-auto p-3 sm:p-4 md:p-6 space-y-2 md:space-y-3 pb-20 md:pb-24">
        
        {/* Header - Ultra-Compact with alerts inline - standardized font sizes */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-sm font-bold text-gray-900 whitespace-nowrap">{t('dashboard.title')}</h1>
            <span className="text-[10px] text-gray-500 whitespace-nowrap">
              {quickStats?.total_projects || 0} {t('dashboard.projects')} • {quickStats?.active_projects || 0} {t('stats.activeProjects')}
            </span>
            {/* Alert Chips - Inline with header */}
            {alerts.map((alert) => (
              <AlertChip key={alert.id} alert={alert} onDismiss={handleDismissAlert} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <FilterDropdown value={timeFilter} onChange={handleFilterChange} />
            <button
              onClick={quickRefresh}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title={t('dashboard.refresh')}
            >
              <RefreshCw size={16} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* TOP: KPI Cards - Responsive Grid (2→3→5 columns) */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
            <KPICard
              label={t('kpi.successRate')}
              value={kpis.project_success_rate || 0}
              change={5.2}
              icon={TrendingUp}
              color="text-green-600"
            />
            <KPICard
              label={t('kpi.budgetPerformance')}
              value={kpis.budget_performance || 0}
              change={-2.1}
              icon={DollarSign}
              color="text-blue-600"
            />
            <KPICard
              label={t('kpi.timelinePerformance')}
              value={kpis.timeline_performance || 0}
              change={3.7}
              icon={Clock}
              color="text-purple-600"
            />
            <KPICard
              label={t('kpi.activeProjects')}
              value={kpis.active_projects_ratio || 0}
              change={1.2}
              icon={BarChart3}
              color="text-indigo-600"
            />
            <KPICard
              label={t('resources.title')}
              value={kpis.resource_efficiency || 0}
              change={0.8}
              icon={Users}
              color="text-teal-600"
            />
          </div>
        )}

        {/* Budget Variance and Variance Trends side by side - always 2 columns on desktop */}
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          {/* Budget Variance - 50% width */}
          <div className="w-full">
            <Suspense fallback={<div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>}>
              <VarianceKPIs session={session} selectedCurrency="USD" />
            </Suspense>
          </div>
          
          {/* Variance Trends - 50% width */}
          <div className="w-full">
            <Suspense fallback={<div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>}>
              <VarianceTrends session={session} selectedCurrency="USD" />
            </Suspense>
          </div>
        </div>

        {/* Health Summary - Full Width */}
        <div className="space-y-2 md:space-y-3">
          {/* Project Health Summary - Compact - standardized font sizes */}
          {quickStats && (
            <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4">
              <h3 className="text-[10px] font-semibold text-gray-900 mb-2 uppercase tracking-wide">{t('health.projectHealth')}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-gray-600">{t('health.healthy')}</span>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{quickStats.health_distribution?.green || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className="text-gray-600">{t('health.atRisk')}</span>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{quickStats.health_distribution?.yellow || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-gray-600">{t('health.critical')}</span>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{quickStats.health_distribution?.red || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Projects Grid - Ultra Compact - standardized font sizes */}
        <div className="bg-white rounded-lg border border-gray-200 p-2">
          <h2 className="text-[10px] font-semibold text-gray-900 mb-1.5 uppercase tracking-wide">{t('projects.recentProjects')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 max-h-[80px] overflow-y-auto">
            {recentProjects.slice(0, 12).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          {recentProjects.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-4">{t('scenarios.noScenarios')}</p>
          )}
        </div>
      </div>

      {/* BOTTOM: Quick Actions - Fixed at bottom of viewport with higher z-index */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 p-3 shadow-2xl z-50">
        <div className="max-w-[1600px] mx-auto flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-semibold text-gray-900 uppercase tracking-wide whitespace-nowrap mr-2">{t('actions.quickActions')}:</span>
          <button onClick={() => {}} className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
            <BarChart3 size={16} className="text-gray-600" />
            <span className="text-sm font-medium">{t('actions.scenarios')}</span>
          </button>
          <button onClick={() => {}} className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
            <Users size={16} className="text-gray-600" />
            <span className="text-sm font-medium">{t('actions.resources')}</span>
          </button>
          <button onClick={() => {}} className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
            <DollarSign size={16} className="text-gray-600" />
            <span className="text-sm font-medium">{t('actions.financials')}</span>
          </button>
          <button onClick={() => {}} className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
            <FileText size={16} className="text-gray-600" />
            <span className="text-sm font-medium">{t('actions.reports')}</span>
          </button>
          <button onClick={() => {}} className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
            <Clock size={16} className="text-gray-600" />
            <span className="text-sm font-medium">Timeline</span>
          </button>
          <button onClick={() => {}} className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
            <TrendingUp size={16} className="text-gray-600" />
            <span className="text-sm font-medium">Analytics</span>
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
